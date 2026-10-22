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

// Delete photos: JSON body { photos: [{ folder, name }, ...] }, or { folder, name } for a single photo.
// Responds with the photos that were deleted and those that failed; a failure doesn't stop the rest.
export const DELETE: APIRoute = async ({ request, locals }) => {
	if (!store) return error(503, 'R2 is not configured on the server');
	const body = await request.json().catch(() => ({}));
	const targets: unknown[] = Array.isArray(body.photos) ? body.photos : [body];
	if (!targets.length || targets.length > 500) return error(400, 'Invalid photo list');
	const valid = (t: any): t is { folder: string; name: string } => isName(t?.folder) && isName(t?.name);
	if (!targets.every(valid)) return error(400, 'Invalid photo');

	const deleted: { folder: string; name: string }[] = [];
	const failed: { folder: string; name: string; error: string }[] = [];
	try {
		await updateManifest(async (manifest) => {
			const removed = new Set<object>();
			for (const { folder, name } of targets as { folder: string; name: string }[]) {
				const photo = findPhoto(manifest, folder, name);
				if (!photo) {
					failed.push({ folder, name, error: 'Photo not found' });
					continue;
				}
				try {
					await store!.deletePhoto(photo);
					removed.add(photo);
					deleted.push({ folder, name });
				} catch (e) {
					console.error(e);
					failed.push({ folder, name, error: 'Delete failed' });
				}
			}
			return { ...manifest, photos: manifest.photos.filter((p) => !removed.has(p)) };
		});
	} catch (e) {
		console.error(e);
		return error(500, 'Delete failed');
	}
	for (const { folder, name } of deleted) console.log(`admin ${locals.adminEmail}: deleted ${folder}/${name}`);
	if (!deleted.length) return Response.json({ error: failed[0]?.error ?? 'Delete failed', deleted, failed }, { status: failed.every((f) => f.error === 'Photo not found') ? 404 : 500 });
	return Response.json({ ok: failed.length === 0, deleted, failed });
};
