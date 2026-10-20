// Regenerates the `images` list of every series in src/data/series.json
// from a local folder that mirrors the structure on the image host:
//   <dir>/<series folder>/<file>.jpg
// Usage: npm run images:manifest -- [dir]   (default: src/assets)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'src/assets');
const manifestPath = path.resolve('src/data/series.json');
const imagePattern = /\.(jpe?g|png|webp|avif)$/i;

const series = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const item of series) {
	const files = await readdir(path.join(root, item.folder)).catch(() => null);
	if (!files) {
		console.warn(`skip ${item.slug}: ${path.join(root, item.folder)} not found`);
		continue;
	}
	item.images = files
		.filter((file) => imagePattern.test(file))
		.sort((left, right) => left.localeCompare(right));
	console.log(`${item.slug}: ${item.images.length} images`);
}

await writeFile(manifestPath, `${JSON.stringify(series, null, 2)}\n`);
