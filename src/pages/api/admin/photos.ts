import type { APIRoute } from 'astro';
import series from '../../../data/series.json';
import { store, updateManifest, upsertPhoto } from '../../../lib/manifest';
import { findPhoto } from '../../../lib/photos';

export const prerender = false;

const FOLDERS = new Set([...series.map((s) => s.folder), 'cover']);
const MAX_BYTES = 100 * 1024 * 1024;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

// Upload one photo: multipart form with `folder` and `file`.
export const POST: APIRoute = async ({ request }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	const form = await request.formData();
	const folder = String(form.get('folder') ?? '');
	const file = form.get('file');
	if (!FOLDERS.has(folder)) return error(400, `Unknown series folder "${folder}"`);
	if (!(file instanceof File) || file.size === 0) return error(400, 'No file');
	if (file.size > MAX_BYTES) return error(413, 'File is larger than 100 MB');

	try {
		const entry = await store.addPhoto(folder, file.name, new Uint8Array(await file.arrayBuffer()));
		await updateManifest((manifest) => upsertPhoto(manifest, entry));
		return Response.json(entry);
	} catch (e) {
		console.error(e);
		return error(500, e instanceof Error ? e.message : 'Upload failed');
	}
};

// Delete one photo: JSON body { folder, name }.
export const DELETE: APIRoute = async ({ request }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	const { folder, name } = await request.json();
	try {
		await updateManifest(async (manifest) => {
			const photo = findPhoto(manifest, folder, name);
			if (!photo) throw new Error('Photo not found');
			await store!.deletePhoto(photo);
			const covers = Object.fromEntries(
				Object.entries(manifest.covers ?? {}).filter(([, c]) => !(c.folder === folder && c.name === name))
			);
			return { ...manifest, covers, photos: manifest.photos.filter((p) => p !== photo) };
		});
		return Response.json({ ok: true });
	} catch (e) {
		return error(e instanceof Error && e.message === 'Photo not found' ? 404 : 500, e instanceof Error ? e.message : 'Delete failed');
	}
};
