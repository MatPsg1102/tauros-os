// Composition root — mesmo padrão do apps/web/src/app/providers.tsx: folha do
// DS injetada uma vez + ThemeProvider aplicando os tokens no root. O service
// worker só é registrado no build de produção (em dev atrapalharia o HMR).

import { ThemeProvider } from '@tauros/theme';
import { injectUiStyles } from '@tauros/ui-primitives';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import { createCloudApi } from './state/cloud.js';

injectUiStyles(document);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Elemento #root ausente no index.html.');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App cloud={createCloudApi()} />
    </ThemeProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Não depender só do evento 'load': se ele já tiver disparado quando este
  // módulo executar, o registro nunca aconteceria (visto em Chromium real).
  const registerServiceWorker = (): void => {
    void navigator.serviceWorker.register('./sw.js');
  };
  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }
}
