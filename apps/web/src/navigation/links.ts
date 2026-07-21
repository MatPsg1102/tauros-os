// Adapter de navegação do APP (7.1 §20) — conecta o contrato neutro do
// Design System ao router do Next. Pertence à aplicação, não ao DS.

'use client';

import type { useRouter } from 'next/navigation';

import type { NavigationLinkAdapter } from '@tauros/ui-primitives';

type AppRouter = ReturnType<typeof useRouter>;

export function appLink(router: AppRouter, href: string): NavigationLinkAdapter {
  return { href, navigate: () => router.push(href) };
}
