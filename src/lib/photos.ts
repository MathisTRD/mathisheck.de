import type { Manifest, Photo } from './manifest';
import taxonomy from '../data/taxonomy.json';

export type { Photo };

export const { subjects, tags } = taxonomy;
export const SUBJECTS = new Set(subjects.map((s) => s.slug));
export const TAGS = new Set(tags.map((t) => t.slug));

export const photoUrl = (baseUrl: string, photo: Photo, width: number, ext: 'avif' | 'webp') =>
	`${baseUrl.replace(/\/+$/, '')}/${photo.folder}/${photo.name}/${width}.${ext}`;

export const srcset = (baseUrl: string, photo: Photo, ext: 'avif' | 'webp', maxWidth = Infinity) =>
	photo.widths
		.filter((w, i) => w <= maxWidth || i === 0)
		.map((w) => `${photoUrl(baseUrl, photo, w, ext)} ${w}w`)
		.join(', ');

export const findPhoto = (manifest: Manifest, folder: string, name: string) =>
	manifest.photos.find((photo) => photo.folder === folder && photo.name === name);

// Photos uploaded before subjects and tags existed only have the folder of their old series.
const LEGACY: Record<string, { subject?: string; tags?: string[] }> = {
	street: { subject: 'street' },
	concert: { subject: 'concert' },
	astro: { subject: 'astro' },
	blackandwhite: { tags: ['bw'] },
	color: { tags: ['color'] },
};

/** The photo's subject, or null if none is set yet. */
export const subjectOf = (photo: Photo): string | null =>
	photo.subject !== undefined ? photo.subject : (LEGACY[photo.folder]?.subject ?? null);

export const tagsOf = (photo: Photo): string[] => photo.tags ?? LEGACY[photo.folder]?.tags ?? [];

/** Photos shown in the gallery: every photo with a subject or a tag, sorted by name. */
export const galleryPhotos = (manifest: Manifest) =>
	manifest.photos
		.filter((photo) => subjectOf(photo) || tagsOf(photo).length)
		.sort((a, b) => a.name.localeCompare(b.name));
