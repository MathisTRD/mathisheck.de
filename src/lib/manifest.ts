// Server-side access to the photo manifest. Reads manifest.json from R2 (cached
// in memory) and falls back to the bundled src/data/photos.json when R2 is not
// configured or has no manifest yet.
import bundled from '../data/photos.json';
import {
	R2_ACCOUNT_ID,
	R2_ACCESS_KEY_ID,
	R2_SECRET_ACCESS_KEY,
	R2_BUCKET,
	R2_PUBLIC_URL,
	R2_JURISDICTION,
	R2_ORIGINALS_BUCKET,
} from 'astro:env/server';
import { createStore, hasR2Config, upsertPhoto } from './photo-store.mjs';

export type Photo = {
	folder: string;
	name: string;
	width: number;
	height: number;
	widths: number[];
	original?: string;
};
export type Manifest = {
	baseUrl: string;
	photos: Photo[];
	covers?: Record<string, { folder: string; name: string }>;
};

const env = { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL, R2_JURISDICTION, R2_ORIGINALS_BUCKET };
export const store = hasR2Config(env) ? createStore(env) : null;

const TTL = 5 * 60 * 1000;
// After a failed R2 read, retry after a minute instead of making every request wait for the timeout.
const RETRY_AFTER_ERROR = 60 * 1000;
let cached: { manifest: Manifest; at: number; ttl: number } | null = null;

export async function getManifest(): Promise<Manifest> {
	if (cached && Date.now() - cached.at < cached.ttl) return cached.manifest;
	let manifest = (cached?.manifest ?? bundled) as Manifest;
	let ttl = TTL;
	if (store) {
		try {
			manifest = ((await store.getManifest()) as Manifest | null) ?? (bundled as Manifest);
		} catch (error) {
			console.error('Could not load manifest from R2, using last known copy', error);
			ttl = RETRY_AFTER_ERROR;
		}
	}
	cached = { manifest, at: Date.now(), ttl };
	return manifest;
}

// Converts one photo at a time; several large conversions in parallel can exhaust the server's memory.
let conversions: Promise<unknown> = Promise.resolve();

export function addPhoto(folder: string, fileName: string, buffer: Uint8Array) {
	if (!store) return Promise.reject(new Error('R2 is not configured'));
	const run = conversions.then(() => store.addPhoto(folder, fileName, buffer));
	conversions = run.catch(() => {});
	return run;
}

// Serializes manifest writes so parallel uploads don't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

export function updateManifest(change: (manifest: Manifest) => Manifest | Promise<Manifest>): Promise<Manifest> {
	if (!store) return Promise.reject(new Error('R2 is not configured'));
	const run = queue.then(async () => {
		cached = null;
		const next = await change(await getManifest());
		await store.saveManifest(next);
		cached = { manifest: { ...next, baseUrl: store.baseUrl }, at: Date.now(), ttl: TTL };
		return cached.manifest;
	});
	queue = run.catch(() => {});
	return run;
}

export { upsertPhoto };
