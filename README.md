# mathisheck.de

Personal photography portfolio, built with [Astro](https://astro.build) and Tailwind CSS
and rendered on the server with the Node adapter.

## How it works

- **Photos** are stored in Cloudflare R2, not in this repository. Each photo is converted
  to AVIF and WebP in several widths and served with responsive `srcset`. A
  `manifest.json` in the bucket lists all photos, so new uploads appear without a redeploy.
- **Admin page** (`/admin`) uploads, deletes and picks series covers. It sits behind
  Cloudflare Access, and the server also verifies the Access token and an email allowlist.

## Deployment

The `DOCKERFILE` builds a production image that runs as a non-root user on port 3000.
Configuration comes from the environment variables listed in `.env.example`.
