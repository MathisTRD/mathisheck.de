// Scans the photo volume and serves
//   GET /_index.json  { version, folders: { "<folder>": ["<file>", ...] } }
//   GET /_version     hash that changes whenever a photo is added, removed or replaced
// After a change (and QUIET_SECONDS without further changes) it redeploys the
// website through the Dokploy API, if DOKPLOY_* is configured.
import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const root = process.env.PHOTOS_DIR ?? '/srv/photos';
const port = Number(process.env.PORT ?? 8080);
const scanSeconds = Number(process.env.SCAN_SECONDS ?? 30);
const quietSeconds = Number(process.env.QUIET_SECONDS ?? 120);
const dokploy = {
	url: process.env.DOKPLOY_URL?.replace(/\/+$/, ''),
	apiKey: process.env.DOKPLOY_API_KEY,
	applicationId: process.env.DOKPLOY_APPLICATION_ID,
};
const imagePattern = /\.(jpe?g|png|webp|avif)$/i;

let index = { version: '', folders: {} };
let pendingSince = 0;

const log = (...args) => console.log(new Date().toISOString(), ...args);

async function scan() {
	const folders = {};
	const hash = createHash('sha256');
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);

	for (const dir of entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))) {
		const files = await readdir(path.join(root, dir.name), { withFileTypes: true });
		const images = files
			.filter((file) => file.isFile() && !file.name.startsWith('.') && imagePattern.test(file.name))
			.map((file) => file.name)
			.sort((left, right) => left.localeCompare(right));

		for (const name of images) {
			const info = await stat(path.join(root, dir.name, name));
			hash.update(`${dir.name}/${name}:${info.size}:${info.mtimeMs}\n`);
		}
		folders[dir.name] = images;
	}

	return { version: hash.digest('hex').slice(0, 16), folders };
}

async function deploy() {
	if (!dokploy.url || !dokploy.apiKey || !dokploy.applicationId) {
		log('photos changed, DOKPLOY_* not set – redeploy the website manually');
		return;
	}
	try {
		const response = await fetch(`${dokploy.url}/api/application.deploy`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': dokploy.apiKey },
			body: JSON.stringify({ applicationId: dokploy.applicationId }),
		});
		log(`redeploy requested: HTTP ${response.status}`, response.ok ? '' : await response.text());
	} catch (error) {
		log('redeploy failed:', error.message);
	}
}

async function tick() {
	try {
		const next = await scan();
		if (index.version && next.version !== index.version) {
			log(`photos changed (${index.version} -> ${next.version})`);
			pendingSince = Date.now();
		}
		index = next;

		if (pendingSince && Date.now() - pendingSince >= quietSeconds * 1000) {
			pendingSince = 0;
			await deploy();
		}
	} catch (error) {
		log('scan failed:', error.message);
	}
	setTimeout(tick, scanSeconds * 1000);
}

createServer((request, response) => {
	const route = new URL(request.url ?? '/', 'http://localhost').pathname;
	if (!index.version) {
		// Not scanned yet: never hand out an empty index to a website build
		response.writeHead(503, { 'retry-after': '5' }).end();
	} else if (route === '/_index.json') {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify(index));
	} else if (route === '/_version') {
		response.writeHead(200, { 'content-type': 'text/plain' });
		response.end(`${index.version}\n`);
	} else {
		response.writeHead(404).end();
	}
}).listen(port, () => log(`indexer listening on :${port}, watching ${root}`));

await tick();
log(`initial scan: ${Object.keys(index.folders).length} folders, version ${index.version}`);
