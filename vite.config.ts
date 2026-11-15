import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url)).replace(/\\/g, '/');

// base: './' → aynı build hem Vercel'de hem GitHub Pages alt dizininde çalışır.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), {
    // public/sounds/raw/ (orijinal ses kayıtları, ~650 MB, git'e girmez) derlemeye kopyalanmasın
    name: 'ham-sesleri-cikar', apply: 'build', closeBundle() { fs.rmSync(path.resolve(__dirname, 'dist/sounds/raw'), { recursive: true, force: true }); fs.rmSync(path.resolve(__dirname, 'dist/soundsv2'), { recursive: true, force: true }); /* soundsv2: kullanılmayan müzik kayıtları */ },
  }],
  server: {
    // Uygulama dışı klasörler izlenmez: raw/ (yüzlerce MB NASA medyası, yazılırken kilitli → EBUSY çökmesi),
    // referans/, scripts/, demo/, dist/ ve KÖK data/ (public/data DEĞİL — o servis edilir, izlenmeli).
    watch: { ignored: ['**/referans/**', '**/raw/**', '**/scripts/**', '**/demo/**', '**/dist/**', '**/*.zip', '**/public/data/**/*.bin', '**/public/sounds/raw/**', `${root('./data')}/**`] },
  },
});
