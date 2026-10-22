# mathisheck.de

Astro site, built with the `DOCKERFILE` and deployed on Dokploy.

```sh
npm install
npm run dev     # localhost:4321
npm run build   # ./dist
```

## Photos (Cloudflare R2)

Photos live in a Cloudflare R2 bucket, not in this repo: AVIF + WebP in widths
360–2000 px under `<folder>/<name>/`, the originals under `originals/`, and the list of
all photos in `manifest.json`. The gallery pages read that manifest at request time, so
new photos show up without a redeploy.

### Upload page

`https://mathisheck.de/admin` (password: `ADMIN_PASSWORD`, any user name). Pick a series,
drop photos in, done. Each photo can also be deleted or set as the series cover.

### Server setup (Dokploy)

Set these in the app's Environment: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `ADMIN_PASSWORD`
(and `R2_JURISDICTION=eu` for an EU bucket). See `.env.example`.
The container runs a Node server on port 80.

### Bulk upload from the PC

Put originals in `photos/<folder>/` (gitignored), fill in `.env`, run
`npm run photos:upload`. Photos already in the manifest are skipped; `--force` re-uploads.

`src/data/photos.json` is only a fallback for when R2 is unreachable or not configured.
