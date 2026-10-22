// Bulk upload: converts every photo in ./photos/<folder>/ that is not in the
// manifest yet, uploads it to Cloudflare R2 and updates manifest.json in R2
// plus the fallback copy in src/data/photos.json.
// For single photos, the /admin page does the same thing in the browser.
//
// Usage:
//   npm run photos:upload              upload new photos
//   npm run photos:upload -- --force   re-upload everything

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createStore, slugify, upsertPhoto } from '../src/lib/photo-store.mjs';

const SOURCE_DIR = process.env.PHOTOS_DIR ?? 'photos';
const LOCAL_MANIFEST = 'src/data/photos.json';
const INPUT_EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const force = process.argv.includes('--force');
const store = createStore(process.env);

let manifest =
	(await store.getManifest()) ??
	(await readFile(LOCAL_MANIFEST, 'utf8').then(JSON.parse, () => null)) ?? { photos: [] };

const folders = (await readdir(SOURCE_DIR, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

for (const folder of folders) {
	const files = (await readdir(path.join(SOURCE_DIR, folder))).filter((f) => INPUT_EXT.test(f)).sort();

	for (const file of files) {
		const name = slugify(file);
		if (!force && manifest.photos.some((p) => p.folder === folder && p.name === name)) {
			console.log(`skip    ${folder}/${name}`);
			continue;
		}
		const entry = await store.addPhoto(folder, file, await readFile(path.join(SOURCE_DIR, folder, file)));
		manifest = upsertPhoto(manifest, entry);
		await store.saveManifest(manifest);
		console.log(`upload  ${folder}/${name} (${entry.widths.length} sizes)`);
	}
}

await store.saveManifest(manifest);
await writeFile(LOCAL_MANIFEST, JSON.stringify({ ...manifest, baseUrl: store.baseUrl }, null, '\t') + '\n');
console.log(`\n${manifest.photos.length} photos in manifest`);
