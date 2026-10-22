// Converts every photo in ./photos/<folder>/ to AVIF + WebP in several widths,
// uploads them to Cloudflare R2 and writes src/data/photos.json for the site.
//
// Usage:
//   node --env-file=.env scripts/upload-photos.mjs            upload new photos
//   node --env-file=.env scripts/upload-photos.mjs --force    re-upload everything
//   node --env-file=.env scripts/upload-photos.mjs --dry-run  only write the manifest

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const SOURCE_DIR = process.env.PHOTOS_DIR ?? 'photos';
const MANIFEST = 'src/data/photos.json';
const WIDTHS = [360, 640, 960, 1280, 1600, 2000];
const FORMATS = {
	avif: (img) => img.avif({ quality: 55, effort: 4 }),
	webp: (img) => img.webp({ quality: 78 }),
};
const INPUT_EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const env = (name) => {
	const value = process.env[name];
	if (!value && !dryRun) throw new Error(`Missing env var ${name} (see .env.example)`);
	return value;
};

const bucket = env('R2_BUCKET');
const baseUrl = (env('R2_PUBLIC_URL') ?? 'https://images.mathisheck.de').replace(/\/+$/, '');
const s3 = dryRun
	? null
	: new S3Client({
			region: 'auto',
			endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: env('R2_ACCESS_KEY_ID'),
				secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
			},
		});

const slugify = (name) =>
	name
		.toLowerCase()
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

const exists = async (key) => {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return true;
	} catch (error) {
		if (error.$metadata?.httpStatusCode === 404) return false;
		throw error;
	}
};

const upload = (key, body, contentType) =>
	s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: 'public, max-age=31536000, immutable',
		})
	);

const folders = (await readdir(SOURCE_DIR, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

const photos = [];

for (const folder of folders) {
	const files = (await readdir(path.join(SOURCE_DIR, folder))).filter((f) => INPUT_EXT.test(f)).sort();

	for (const file of files) {
		const name = slugify(file);
		const source = sharp(path.join(SOURCE_DIR, folder, file)).rotate();
		const meta = await source.metadata();
		const rotated = (meta.orientation ?? 1) >= 5;
		const width = rotated ? meta.height : meta.width;
		const height = rotated ? meta.width : meta.height;
		const largest = Math.min(width, WIDTHS.at(-1));
		const widths = [...WIDTHS.filter((w) => w < largest), largest];

		const prefix = `${folder}/${name}`;
		photos.push({ folder, name, width, height, widths });

		if (dryRun) {
			console.log(`[dry-run] ${prefix} (${width}x${height}) -> ${widths.join(', ')}`);
			continue;
		}

		const lastKey = `${prefix}/${widths.at(-1)}.webp`;
		if (!force && (await exists(lastKey))) {
			console.log(`skip    ${prefix}`);
			continue;
		}

		for (const w of widths) {
			const resized = source.clone().resize({ width: w, withoutEnlargement: true });
			for (const [ext, encode] of Object.entries(FORMATS)) {
				const body = await encode(resized.clone()).toBuffer();
				await upload(`${prefix}/${w}.${ext}`, body, `image/${ext}`);
			}
		}
		console.log(`upload  ${prefix} (${widths.length} sizes)`);
	}
}

await writeFile(MANIFEST, JSON.stringify({ baseUrl, photos }, null, '\t') + '\n');
console.log(`\nWrote ${photos.length} photos to ${MANIFEST}`);
