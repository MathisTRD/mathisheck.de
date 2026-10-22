import type { APIRoute } from 'astro';
import series from '../../../data/series.json';
import { addPhoto, store, updateManifest, upsertPhoto } from '../../../lib/manifest';
import { findPhoto } from '../../../lib/photos';

const FOLDERS = new Set([...series.map((s) => s.folder), 'cover']);
const MAX_BYTES = 100 * 1024 * 1024;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const isName = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,200}$/.test(value);

// Upload one photo: multipart form with `folder` and `file`.
export const POST: APIRoute = async ({ request, locals }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return error(413, 'Upload is too large or malformed (max. 100 MB)');
	}
	const folder = String(form.get('folder') ?? '');
	const file = form.get('file');
	if (!FOLDERS.has(folder)) return error(400, 'Unknown series');
	if (!(file instanceof File) || file.size === 0) return error(400, 'No file');
	if (file.size > MAX_BYTES) return error(413, 'File is larger than 100 MB');

	try {
		const entry = await addPhoto(folder, file.name, new Uint8Array(await file.arrayBuffer()));
		await updateManifest((manifest) => upsertPhoto(manifest, entry));
		console.log(`admin ${locals.adminEmail}: uploaded ${entry.folder}/${entry.name}`);
		return Response.json(entry);
	} catch (e) {
		console.error(e);
		const message = e instanceof Error && e.message.includes('not a supported image') ? e.message : 'Upload failed';
		return error(500, message);
	}
};

// Delete one photo: JSON body { folder, name }.
export const DELETE: APIRoute = async ({ request, locals }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	const { folder, name } = await request.json().catch(() => ({}));
	if (!FOLDERS.has(folder) || !isName(name)) return error(400, 'Invalid photo');
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
		console.log(`admin ${locals.adminEmail}: deleted ${folder}/${name}`);
		return Response.json({ ok: true });
	} catch (e) {
		if (e instanceof Error && e.message === 'Photo not found') return error(404, e.message);
		console.error(e);
		return error(500, 'Delete failed');
	}
};
