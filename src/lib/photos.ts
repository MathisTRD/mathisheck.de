import type { Manifest, Photo } from './manifest';
import { slugify } from './photo-store.mjs';

export type { Photo };

export const photoUrl = (baseUrl: string, photo: Photo, width: number, ext: 'avif' | 'webp') =>
	`${baseUrl.replace(/\/+$/, '')}/${photo.folder}/${photo.name}/${width}.${ext}`;

export const srcset = (baseUrl: string, photo: Photo, ext: 'avif' | 'webp', maxWidth = Infinity) =>
	photo.widths
		.filter((w, i) => w <= maxWidth || i === 0)
		.map((w) => `${photoUrl(baseUrl, photo, w, ext)} ${w}w`)
		.join(', ');

export const photosInFolder = (manifest: Manifest, folder: string) =>
	manifest.photos.filter((photo) => photo.folder === folder).sort((a, b) => a.name.localeCompare(b.name));

export const findPhoto = (manifest: Manifest, folder: string, name: string) =>
	manifest.photos.find((photo) => photo.folder === folder && photo.name === name);

/** The cover picked in /admin, else the photo in cover/ named like series.json's `cover`, else the first photo of the series. */
export const getCover = (manifest: Manifest, series: { slug: string; folder: string; cover: string }) => {
	const picked = manifest.covers?.[series.slug];
	return (
		(picked && findPhoto(manifest, picked.folder, picked.name)) ??
		findPhoto(manifest, 'cover', slugify(series.cover)) ??
		photosInFolder(manifest, series.folder)[0]
	);
};
