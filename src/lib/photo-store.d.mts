export const WIDTHS: number[];
export function slugify(name: string): string;
export function hasR2Config(env: Record<string, string | undefined>): boolean;
export function createStore(env: Record<string, string | undefined>): {
	baseUrl: string;
	getManifest(): Promise<unknown | null>;
	saveManifest(manifest: unknown): Promise<void>;
	addPhoto(
		folder: string,
		fileName: string,
		buffer: Buffer | Uint8Array
	): Promise<{ folder: string; name: string; width: number; height: number; widths: number[]; original: string }>;
	deletePhoto(photo: { folder: string; name: string; original?: string }): Promise<void>;
};
export function upsertPhoto<M extends { photos: P[] }, P extends { folder: string; name: string }>(manifest: M, entry: P): M;
