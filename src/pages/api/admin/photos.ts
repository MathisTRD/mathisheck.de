import type { APIRoute } from 'astro';
import { addPhoto, store, updateManifest, upsertPhoto } from '../../../lib/manifest';
import { findPhoto, SUBJECTS, TAGS } from '../../../lib/photos';

const MAX_BYTES = 100 * 1024 * 1024;

const error = (status: number, message: string) => Response.json({ error: message }, { status });
const isName = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,200}$/.test(value);
const isTagList = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((tag) => TAGS.has(tag)) && new Set(value).size === value.length;

// Upload one photo: multipart form with `subject`, any number of `tag` fields and `file`.
// The photo is stored in the folder named after its subject.
export const POST: APIRoute = async ({ request, locals }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return error(413, 'Upload is too large or malformed (max. 100 MB)');
	}
	const subject = String(form.get('subject') ?? '');
	const tags = form.getAll('tag').map(String);
	const file = form.get('file');
	if (!SUBJECTS.has(subject)) return error(400, 'Unknown subject');
	if (!isTagList(tags)) return error(400, 'Unknown tag');
	if (!(file instanceof File) || file.size === 0) return error(400, 'No file');
	if (file.size > MAX_BYTES) return error(413, 'File is larger than 100 MB');

	try {
		const stored = await addPhoto(subject, file.name, new Uint8Array(await file.arrayBuffer()));
		const entry = { ...stored, subject, tags };
		await updateManifest((manifest) => upsertPhoto(manifest, entry));
		console.log(`admin ${locals.adminEmail}: uploaded ${entry.folder}/${entry.name}`);
		return Response.json(entry);
	} catch (e) {
		console.error(e);
		const message = e instanceof Error && e.message.includes('not a supported image') ? e.message : 'Upload failed';
		return error(500, message);
	}
};

// Set subject and tags of one photo: JSON body { folder, name, subject: string | null, tags: string[] }.
export const PATCH: APIRoute = async ({ request, locals }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	const { folder, name, subject, tags } = await request.json().catch(() => ({}));
	if (!isName(folder) || !isName(name)) return error(400, 'Invalid photo');
	if (subject !== null && !SUBJECTS.has(subject)) return error(400, 'Unknown subject');
	if (!isTagList(tags)) return error(400, 'Unknown tag');
	try {
		await updateManifest((manifest) => {
			const photo = findPhoto(manifest, folder, name);
			if (!photo) throw new Error('Photo not found');
			return upsertPhoto(manifest, { ...photo, subject, tags });
		});
		console.log(`admin ${locals.adminEmail}: tagged ${folder}/${name} as ${subject ?? '-'} [${tags.join(', ')}]`);
		return Response.json({ ok: true });
	} catch (e) {
		if (e instanceof Error && e.message === 'Photo not found') return error(404, e.message);
		console.error(e);
		return error(500, 'Save failed');
	}
};

// Delete one photo: JSON body { folder, name }.
export const DELETE: APIRoute = async ({ request, locals }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	const { folder, name } = await request.json().catch(() => ({}));
	if (!isName(folder) || !isName(name)) return error(400, 'Invalid photo');
	try {
		await updateManifest(async (manifest) => {
			const photo = findPhoto(manifest, folder, name);
			if (!photo) throw new Error('Photo not found');
			await store!.deletePhoto(photo);
			return { ...manifest, photos: manifest.photos.filter((p) => p !== photo) };
		});
		console.log(`admin ${locals.adminEmail}: deleted ${folder}/${name}`);
		return Response.json({ ok: true });
	} catch (e) {
		if (e instanceof Error && e.message === 'Photo not found') return error(404, e.message);
		console.error(e);
		return error(500, 'Delete failed');
	}
};
