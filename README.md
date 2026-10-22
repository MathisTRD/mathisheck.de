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

`https://mathisheck.de/admin`: pick a series, drop photos in, done. Each photo can also be
deleted or set as the series cover. Originals go to the private `R2_ORIGINALS_BUCKET`.

`/admin` and `/api/admin/*` are protected by **Cloudflare Access** (login at Cloudflare,
with 2FA). The server additionally verifies the Access JWT and the email against
`ADMIN_EMAILS`, so requests that bypass Cloudflare are rejected. Without the
`CF_ACCESS_*` / `ADMIN_EMAILS` env vars the admin area is disabled.

### Server setup (Dokploy)

Set the variables from `.env.example` in the app's Environment. The container runs as a
non-root user on port **3000**.

### Bulk upload from the PC

Put originals in `photos/<folder>/` (gitignored), fill in `.env`, run
`npm run photos:upload`. Photos already in the manifest are skipped; `--force` re-uploads.

`src/data/photos.json` is only a fallback for when R2 is unreachable or not configured.
