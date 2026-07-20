import type { ReactNode } from 'react';

export const metadata = {
  title: 'Tauros OS',
  description: 'PWA operacional de gestão de açougue',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
