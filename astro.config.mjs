// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import tailwindcss from '@tailwindcss/vite';

const { PUBLIC_IMAGE_BASE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const imageHost = PUBLIC_IMAGE_BASE_URL ? new URL(PUBLIC_IMAGE_BASE_URL) : null;

// https://astro.build/config
export default defineConfig({
  image: {
    // Allow Astro to download and optimize images from the external host at build time
    remotePatterns: imageHost ? [{ protocol: imageHost.protocol.replace(':', ''), hostname: imageHost.hostname }] : [],
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
