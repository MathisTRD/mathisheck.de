import manifest from '../data/photos.json';

export type Photo = (typeof manifest.photos)[number];

const base = manifest.baseUrl.replace(/\/+$/, '');

export const photoUrl = (photo: Photo, width: number, ext: 'avif' | 'webp') =>
	`${base}/${photo.folder}/${photo.name}/${width}.${ext}`;

export const srcset = (photo: Photo, ext: 'avif' | 'webp', maxWidth = Infinity) =>
	photo.widths
		.filter((w, i) => w <= maxWidth || i === 0)
		.map((w) => `${photoUrl(photo, w, ext)} ${w}w`)
		.join(', ');

export const photosInFolder = (folder: string) =>
	manifest.photos.filter((photo) => photo.folder === folder).sort((a, b) => a.name.localeCompare(b.name));

export const getPhoto = (folder: string, file: string) => {
	const name = file
		.toLowerCase()
		.replace(/\.[^.]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return manifest.photos.find((photo) => photo.folder === folder && photo.name === name);
};
