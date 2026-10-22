// Shared R2 photo storage, used by the admin API and scripts/upload-photos.mjs.
// Each photo is stored in the public bucket as <folder>/<name>/<width>.<avif|webp>,
// the list of all photos as manifest.json, and the untouched original in the
// private R2_ORIGINALS_BUCKET as <folder>/<name>.<ext> (skipped if that is not set).

import sharp from 'sharp';
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

export const WIDTHS = [360, 640, 960, 1280, 1600, 2000];
const FORMATS = {
	avif: (img) => img.avif({ quality: 55, effort: 4 }),
	webp: (img) => img.webp({ quality: 78 }),
};
const MANIFEST_KEY = 'manifest.json';
const ORIGINAL_FORMATS = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', tiff: 'tif', heif: 'heic' };
const MAX_PIXELS = 200_000_000;

export const slugify = (name) =>
	name
		.toLowerCase()
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

export const hasR2Config = (env) =>
	['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'].every((k) => env[k]);

export function createStore(env) {
	for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL']) {
		if (!env[name]) throw new Error(`Missing env var ${name} (see .env.example)`);
	}
	const accountId = env.R2_ACCOUNT_ID.trim();
	if (!/^[0-9a-f]{32}$/i.test(accountId)) {
		throw new Error('R2_ACCOUNT_ID must be the 32-character account ID only, not a URL');
	}
	const jurisdiction = env.R2_JURISDICTION?.trim();
	if (jurisdiction && !/^[a-z]+$/.test(jurisdiction)) {
		throw new Error('R2_JURISDICTION must be a short code like "eu", not a URL');
	}

	const bucket = env.R2_BUCKET;
	const originalsBucket = env.R2_ORIGINALS_BUCKET || null;
	if (originalsBucket === bucket) throw new Error('R2_ORIGINALS_BUCKET must be a separate, private bucket');
	const baseUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
	const s3 = new S3Client({
		region: 'auto',
		forcePathStyle: true,
		endpoint: `https://${accountId}.${jurisdiction ? jurisdiction + '.' : ''}r2.cloudflarestorage.com`,
		credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
	});

	const put = (key, body, contentType, cacheControl = 'public, max-age=31536000, immutable', target = bucket) =>
		s3.send(new PutObjectCommand({ Bucket: target, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }));

	const deleteKeys = async (keys, target = bucket) => {
		for (let i = 0; i < keys.length; i += 1000) {
			await s3.send(
				new DeleteObjectsCommand({ Bucket: target, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } })
			);
		}
	};

	const listKeys = async (prefix) => {
		const keys = [];
		let token;
		do {
			const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
			keys.push(...(page.Contents ?? []).map((o) => o.Key));
			token = page.IsTruncated ? page.NextContinuationToken : undefined;
		} while (token);
		return keys;
	};

	return {
		baseUrl,

		/** Returns the manifest stored in R2, or null if there is none yet. */
		async getManifest() {
			try {
				const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: MANIFEST_KEY }), {
					abortSignal: AbortSignal.timeout(5000),
				});
				return JSON.parse(await res.Body.transformToString());
			} catch (error) {
				if (error.$metadata?.httpStatusCode === 404 || error.name === 'NoSuchKey') return null;
				throw error;
			}
		},

		async saveManifest(manifest) {
			await put(MANIFEST_KEY, JSON.stringify({ ...manifest, baseUrl }, null, '\t'), 'application/json', 'no-cache');
		},

		/** Converts one photo, uploads all sizes plus the original, and returns its manifest entry. */
		async addPhoto(folder, fileName, buffer) {
			const name = slugify(fileName);
			if (!name) throw new Error(`Invalid file name "${fileName}"`);
			const source = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS }).rotate();
			const meta = await source.metadata().catch(() => ({}));
			const ext = ORIGINAL_FORMATS[meta.format];
			if (!ext || !meta.width || !meta.height) throw new Error(`"${fileName}" is not a supported image (JPEG, PNG, WebP, AVIF, TIFF, HEIC)`);
			const rotated = (meta.orientation ?? 1) >= 5;
			const width = rotated ? meta.height : meta.width;
			const height = rotated ? meta.width : meta.height;
			const largest = Math.min(width, WIDTHS.at(-1));
			const widths = [...WIDTHS.filter((w) => w < largest), largest];

			for (const w of widths) {
				const resized = source.clone().resize({ width: w, withoutEnlargement: true });
				for (const [ext, encode] of Object.entries(FORMATS)) {
					await put(`${folder}/${name}/${w}.${ext}`, await encode(resized.clone()).toBuffer(), `image/${ext}`);
				}
			}
			const entry = { folder, name, width, height, widths };
			if (originalsBucket) {
				const original = `${folder}/${name}.${ext}`;
				await put(original, buffer, `image/${meta.format}`, 'private, no-store', originalsBucket);
				entry.original = original;
			}
			return entry;
		},

		/** Deletes every stored size of a photo and its original. */
		async deletePhoto(photo) {
			await deleteKeys(await listKeys(`${photo.folder}/${photo.name}/`));
			if (photo.original && originalsBucket && !photo.original.startsWith('originals/')) {
				await deleteKeys([photo.original], originalsBucket);
			} else if (photo.original?.startsWith('originals/')) {
				// Originals from before R2_ORIGINALS_BUCKET existed sit in the public bucket.
				await deleteKeys([photo.original]);
			}
		},
	};
}

/**
 * Returns a copy of the manifest with the entry inserted or replaced, sorted by folder and name.
 * A replaced photo keeps its subject and tags unless the entry sets them.
 */
export const upsertPhoto = (manifest, entry) => {
	const same = (p) => p.folder === entry.folder && p.name === entry.name;
	const existing = manifest.photos.find(same);
	const merged = existing ? { subject: existing.subject, tags: existing.tags, ...entry } : entry;
	for (const key of ['subject', 'tags']) if (merged[key] === undefined) delete merged[key];
	return {
		...manifest,
		photos: [...manifest.photos.filter((p) => !same(p)), merged].sort(
			(a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name)
		),
	};
};
