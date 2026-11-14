import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url)).replace(/\\/g, '/');

// base: './' → aynı build hem Vercel'de hem GitHub Pages alt dizininde çalışır.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    // Uygulama dışı klasörler izlenmez: raw/ (yüzlerce MB NASA medyası, yazılırken kilitli → EBUSY çökmesi),
    // referans/, scripts/, demo/, dist/ ve KÖK data/ (public/data DEĞİL — o servis edilir, izlenmeli).
    watch: { ignored: ['**/referans/**', '**/raw/**', '**/scripts/**', '**/demo/**', '**/dist/**', '**/*.zip', '**/public/data/**/*.bin', `${root('./data')}/**`] },
  },
});
