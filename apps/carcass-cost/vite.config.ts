// Build estático do Custo da Carcaça — SPA leve, offline-first.
// `base: './'` permite servir de qualquer subcaminho (mesma origem do SW).
// O plugin local emite o sw.js a partir de sw.template.js com a lista REAL de
// assets do build no precache (sem isso, a 2ª abertura offline cai em tela
// branca: o bundle com hash nunca entraria no cache na 1ª visita) e versiona
// o cache pelo conteúdo — cada deploy reinstala o SW e limpa caches antigos.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const APP_DIR = dirname(fileURLToPath(import.meta.url));

function serviceWorkerPrecache(): Plugin {
  return {
    name: 'carcass-cost-sw-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      const shell = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icon.svg',
        './apple-touch-icon.png',
      ];
      const built = Object.keys(bundle)
        .filter((fileName) => fileName !== 'index.html')
        .map((fileName) => `./${fileName}`);
      const precache = [...new Set([...shell, ...built])];
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      const template = readFileSync(join(APP_DIR, 'sw.template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replaceAll('__CACHE_VERSION__', version)
          .replaceAll('__PRECACHE_ASSETS__', JSON.stringify(precache)),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerPrecache()],
  server: { port: 3010 },
  build: { target: 'es2022' },
});
