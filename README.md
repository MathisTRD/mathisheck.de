# mathisheck.de

Personal photography portfolio, built with [Astro](https://astro.build) and Tailwind CSS
and rendered on the server with the Node adapter.

## How it works

- **Photos** are stored in Cloudflare R2, not in this repository. Each photo is converted
  to AVIF and WebP in several widths and served with responsive `srcset`. A
  `manifest.json` in the bucket lists all photos, so new uploads appear without a redeploy.
- **Subjects and tags**: every photo has one subject (Alltag, Konzerte, Astro) and any number of
  tags (Schwarzweiß, Farbe), defined in `src/data/taxonomy.json`. `/images` shows one gallery
  with filters (`?motiv=street&tag=bw`). Photos from the old series folders get defaults from
  their folder until they are edited.
- **Admin page** (`/admin`) uploads, deletes and sets subject and tags of each photo. It sits behind
  Cloudflare Access, and the server also verifies the Access token and an email allowlist.

## Deployment

The `DOCKERFILE` builds a production image that runs as a non-root user on port 3000.
Configuration comes from the environment variables listed in `.env.example`.

## Analytics

[Umami](https://umami.is) runs as its own Dokploy service (e.g. `stats.mathisheck.de`). Set
`UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` to load the tracker on all public pages; the CSP then
allows that host. `/admin` does not use the shared layout and is never tracked.
