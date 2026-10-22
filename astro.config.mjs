// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

import tailwindcss from '@tailwindcss/vite';

const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

// https://astro.build/config
export default defineConfig({
  // Every page renders on the server so src/middleware.ts can set security headers on all of them.
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 110 * 1024 * 1024 }),
  // Origin checks break behind Dokploy's TLS proxy; /api/admin requires a custom header instead (see src/middleware.ts).
  security: { checkOrigin: false },
  env: {
    schema: {
      R2_ACCOUNT_ID: secret(),
      R2_ACCESS_KEY_ID: secret(),
      R2_SECRET_ACCESS_KEY: secret(),
      R2_BUCKET: secret(),
      R2_ORIGINALS_BUCKET: secret(),
      R2_PUBLIC_URL: secret(),
      R2_JURISDICTION: secret(),
      CF_ACCESS_TEAM_DOMAIN: secret(),
      CF_ACCESS_AUD: secret(),
      ADMIN_EMAILS: secret(),
      UMAMI_SCRIPT_URL: secret(),
      UMAMI_WEBSITE_ID: secret(),
    },
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
