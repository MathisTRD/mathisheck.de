# mathisheck.de

Personal photography portfolio, built with [Astro](https://astro.build) and Tailwind CSS
and rendered on the server with the Node adapter.

## Development

Requires Node.js 22.23.4 or newer.

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # production build in ./dist
npm start       # serve the build on port 3000
```

Copy `.env.example` to `.env` and fill in the values. Without them the site still runs
with the bundled photo list in `src/data/photos.json`.

## How it works

- **Photos** are stored in Cloudflare R2, not in this repository. Each photo is converted
  to AVIF and WebP in several widths and served with responsive `srcset`. A
  `manifest.json` in the bucket lists all photos, so new uploads appear without a redeploy.
- **Admin page** (`/admin`) uploads, deletes and picks series covers. It sits behind
  Cloudflare Access, and the server also verifies the Access token and an email allowlist.
- **Bulk upload**: `npm run photos:upload` converts and uploads everything in
  `photos/<series>/` that is not in the manifest yet.

## Deployment

The `DOCKERFILE` builds a production image that runs as a non-root user on port 3000.
Configuration comes from the environment variables listed in `.env.example`.
