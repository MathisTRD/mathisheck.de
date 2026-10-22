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

const env = { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL, R2_JURISDICTION };
export const store = hasR2Config(env) ? createStore(env) : null;

const TTL = 5 * 60 * 1000;
let cached: { manifest: Manifest; at: number } | null = null;

export async function getManifest(): Promise<Manifest> {
	if (cached && Date.now() - cached.at < TTL) return cached.manifest;
	let manifest = bundled as Manifest;
	if (store) {
		try {
			manifest = ((await store.getManifest()) as Manifest | null) ?? manifest;
		} catch (error) {
			console.error('Could not load manifest from R2, using bundled copy', error);
			if (cached) return cached.manifest;
		}
	}
	cached = { manifest, at: Date.now() };
	return manifest;
}

// Serializes manifest writes so parallel uploads don't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

export function updateManifest(change: (manifest: Manifest) => Manifest | Promise<Manifest>): Promise<Manifest> {
	if (!store) return Promise.reject(new Error('R2 is not configured'));
	const run = queue.then(async () => {
		cached = null;
		const next = await change(await getManifest());
		await store.saveManifest(next);
		cached = { manifest: { ...next, baseUrl: store.baseUrl }, at: Date.now() };
		return cached.manifest;
	});
	queue = run.catch(() => {});
	return run;
}

export { upsertPhoto };
