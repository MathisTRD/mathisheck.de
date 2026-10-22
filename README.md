# mathisheck.de

Astro site, built with the `DOCKERFILE` and deployed on Dokploy.

```sh
npm install
npm run dev     # localhost:4321
npm run build   # ./dist
```

## Photos (Cloudflare R2)

Photos are not stored in this repo. They live in a Cloudflare R2 bucket as AVIF + WebP
in widths 360, 640, 960, 1280, 1600 and 2000 px. `src/data/photos.json` lists them and is
what the site builds from.

Add or change photos:

1. Put the originals in `photos/<folder>/` (gitignored). `<folder>` is the `folder` from
   `src/data/series.json`; covers go in `photos/cover/` and are referenced by `cover`.
2. Copy `.env.example` to `.env` and fill in the R2 values.
3. `npm run photos:upload` converts and uploads new photos and rewrites `src/data/photos.json`.
   `--force` re-uploads everything, `--dry-run` only rewrites the manifest.
4. Commit `src/data/photos.json` and push. Dokploy redeploys.

Removing a photo: delete it from `photos/`, run the script, commit. The files stay in R2
until you delete them there.
