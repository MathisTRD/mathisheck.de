import type { APIRoute } from 'astro';
import series from '../../../data/series.json';
import { store, updateManifest } from '../../../lib/manifest';
import { findPhoto } from '../../../lib/photos';

export const prerender = false;

// Use a photo as a series cover: JSON body { slug, folder, name }.
export const POST: APIRoute = async ({ request }) => {
	if (!store) return Response.json({ error: 'R2 is not configured on the server' }, { status: 503 });
	const { slug, folder, name } = await request.json();
	if (!series.some((s) => s.slug === slug)) return Response.json({ error: 'Unknown series' }, { status: 400 });
	try {
		await updateManifest((manifest) => {
			if (!findPhoto(manifest, folder, name)) throw new Error('Photo not found');
			return { ...manifest, covers: { ...manifest.covers, [slug]: { folder, name } } };
		});
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
	}
};
