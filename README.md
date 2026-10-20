# mathisheck.de

Photography portfolio built with Astro and Tailwind CSS.

## Commands

| Command                    | Action                                                  |
| :------------------------- | :------------------------------------------------------ |
| `npm install`              | Install dependencies                                    |
| `npm run dev`              | Start dev server at `localhost:4321`                    |
| `npm run build`            | Build the static site to `./dist/`                      |
| `npm run preview`          | Preview the build locally                               |
| `npm run images:manifest`  | Rebuild the image lists in `src/data/series.json`       |

## Images

Series and their images are listed in `src/data/series.json`:

- `cover`: path of the cover image, e.g. `cover/street.jpg`
- `folder`: folder of the series, e.g. `street`
- `images`: file names inside that folder

Image paths are resolved in `src/lib/images.ts`:

- `PUBLIC_IMAGE_BASE_URL` set → images are loaded from `<base>/<path>`,
  e.g. `https://res.cloudinary.com/<cloud>/image/upload/mathisheck/street/foo.jpg`.
- not set → images are loaded from `src/assets/<path>`.

In both cases Astro downloads/reads the originals at build time and ships optimized
WebP variants in `dist/`, so the external host only has to serve the originals to the build.

### Hosting images externally

1. Upload the images to any public host (Cloudinary, Cloudflare R2, Bunny, S3, …),
   keeping the structure `cover/…`, `street/…`, `color/…`, `blackandwhite/…`, `astro/…`, `concert/…`.
2. Set the base URL (see `.env.example`):
   - locally: `.env` with `PUBLIC_IMAGE_BASE_URL=…`
   - Docker: `docker build --build-arg PUBLIC_IMAGE_BASE_URL=… -f DOCKERFILE .`
3. Add new images: put them on the host, then add the file names to `images` in
   `src/data/series.json` (or keep a local mirror folder and run
   `npm run images:manifest -- <folder>`).
4. Remove the images from the repository:
   ```sh
   git rm -r --cached src/assets
   echo "src/assets/" >> .gitignore
   ```
   They stay in the git history. To shrink the repository as well, rewrite history with
   [`git filter-repo`](https://github.com/newren/git-filter-repo) (`git filter-repo --path src/assets --invert-paths`)
   and force-push.
