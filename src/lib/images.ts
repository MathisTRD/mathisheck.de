import type { ImageMetadata } from 'astro';

// Base URL of the external image host, e.g. https://res.cloudinary.com/<cloud>/image/upload/mathisheck
// When unset, images are loaded from src/assets (local development / fallback).
const baseUrl = import.meta.env.PUBLIC_IMAGE_BASE_URL?.replace(/\/+$/, '');

const localImages = import.meta.glob<ImageMetadata>('../assets/**/*.{jpg,jpeg,png,webp,avif}', {
	import: 'default',
});

export type ResolvedImage = ImageMetadata | string;

/** Resolves a path like "street/foo.jpg" (or an absolute URL) to something <Image> accepts. */
export async function resolveImage(imagePath: string): Promise<ResolvedImage> {
	if (/^https?:\/\//.test(imagePath)) return imagePath;
	if (baseUrl) return `${baseUrl}/${imagePath.split('/').map(encodeURIComponent).join('/')}`;

	const load = localImages[`../assets/${imagePath}`];
	if (!load) {
		throw new Error(`Image "${imagePath}" not found in src/assets and PUBLIC_IMAGE_BASE_URL is not set.`);
	}
	return load();
}

export const isRemote = (image: ResolvedImage): image is string => typeof image === 'string';
