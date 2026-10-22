import type { APIRoute } from 'astro';
import series from '../../../data/series.json';
import { store, updateManifest } from '../../../lib/manifest';
import { findPhoto } from '../../../lib/photos';

// Use a photo as a series cover: JSON body { slug, folder, name }.
export const POST: APIRoute = async ({ request }) => {
	if (!store) return Response.json({ error: 'R2 is not configured on the server' }, { status: 503 });
	const { slug, folder, name } = await request.json().catch(() => ({}));
	if (!series.some((s) => s.slug === slug) || typeof folder !== 'string' || typeof name !== 'string') {
		return Response.json({ error: 'Invalid request' }, { status: 400 });
	}
	try {
		await updateManifest((manifest) => {
			if (!findPhoto(manifest, folder, name)) throw new Error('Photo not found');
			return { ...manifest, covers: { ...manifest.covers, [slug]: { folder, name } } };
		});
		return Response.json({ ok: true });
	} catch (e) {
		if (e instanceof Error && e.message === 'Photo not found') return Response.json({ error: e.message }, { status: 404 });
		console.error(e);
		return Response.json({ error: 'Failed' }, { status: 500 });
	}
};
