import type { ImageMetadata } from 'astro';

// Base URL of the image server (see image-server/), e.g. https://images.mathisheck.de
// When unset, images are loaded from src/assets (local development / fallback).
const baseUrl = import.meta.env.PUBLIC_IMAGE_BASE_URL?.replace(/\/+$/, '');

const localImages = import.meta.glob<ImageMetadata>('../assets/**/*.{jpg,jpeg,png,webp,avif}', {
	import: 'default',
});

export type ResolvedImage = ImageMetadata | string;

type RemoteIndex = { version: string; folders: Record<string, string[]> };

let remoteIndex: Promise<RemoteIndex> | undefined;

const loadRemoteIndex = () =>
	(remoteIndex ??= fetch(`${baseUrl}/_index.json`).then(async (response) => {
		if (!response.ok) {
			throw new Error(`Could not load ${baseUrl}/_index.json: HTTP ${response.status}`);
		}
		return (await response.json()) as RemoteIndex;
	}));

/** Lists the image file names of a series folder, sorted by name. */
export async function listFolder(folder: string): Promise<string[]> {
	if (baseUrl) {
		const { folders } = await loadRemoteIndex();
		return folders[folder] ?? [];
	}

	const prefix = `../assets/${folder}/`;
	return Object.keys(localImages)
		.filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
		.map((key) => key.slice(prefix.length))
		.sort((left, right) => left.localeCompare(right));
}

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
