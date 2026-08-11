import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// GitHub Pages serves this repo at /synthetic-web-team/, so `base` is required.
// Without it internal links work locally and break in production, which is
// gotcha 4 in our own recipe.
export default defineConfig({
  site: 'https://su-sws.github.io',
  base: '/synthetic-web-team',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
