import type { ReactNode } from 'react';

import { AppProviders } from './providers.js';

export const metadata = {
  title: 'Tauros OS',
  description: 'PWA operacional de gestão de açougue',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
