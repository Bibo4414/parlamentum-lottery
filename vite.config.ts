import { defineConfig } from 'vite';

// GitHub Pages serves the site from /parlamentum-lottery/, so built asset paths stay relative.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
