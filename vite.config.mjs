import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: resolve(__dirname, 'public'),
  plugins: [svelte()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome130',
    rollupOptions: { input: { control: resolve(__dirname, 'src/control.html'), output: resolve(__dirname, 'src/output.html'), stage: resolve(__dirname, 'src/stage.html'), overlay: resolve(__dirname, 'src/overlay.html'), remote: resolve(__dirname, 'src/remote.html') } },
  },
  server: { port: 5199, strictPort: true },
});
