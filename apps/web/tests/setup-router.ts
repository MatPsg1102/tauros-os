// Setup de teste: o roteador do Next não existe em jsdom. O adapter de
// navegação da aplicação (navigation/links.ts) é a ÚNICA fronteira com ele,
// então o mock fica aqui — nenhum teste de UI precisa conhecer o router.
// As navegações ficam observáveis para asserção.

import { vi } from 'vitest';

declare global {
  var __taurosNavigations: string[] | undefined;
}

globalThis.__taurosNavigations = [];

/** Rotas visitadas via appLink desde o último reset. */
export function navigations(): readonly string[] {
  return globalThis.__taurosNavigations ?? [];
}

export function resetNavigations(): void {
  globalThis.__taurosNavigations = [];
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (href: string) => {
      globalThis.__taurosNavigations = [...(globalThis.__taurosNavigations ?? []), href];
    },
    replace: () => undefined,
    prefetch: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
  }),
}));
