// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

import tailwindcss from '@tailwindcss/vite';

const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

// https://astro.build/config
export default defineConfig({
  // Static pages stay prerendered; the gallery, /admin and /api/admin run on the server.
  adapter: node({ mode: 'standalone' }),
  // Origin checks break behind Dokploy's TLS proxy; /api/admin requires a custom header instead (see src/middleware.ts).
  security: { checkOrigin: false },
  env: {
    schema: {
      R2_ACCOUNT_ID: secret(),
      R2_ACCESS_KEY_ID: secret(),
      R2_SECRET_ACCESS_KEY: secret(),
      R2_BUCKET: secret(),
      R2_PUBLIC_URL: secret(),
      R2_JURISDICTION: secret(),
      ADMIN_PASSWORD: secret(),
    },
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
