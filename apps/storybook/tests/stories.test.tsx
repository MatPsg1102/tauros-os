// Contrato executável (6.3.8 §27): TODAS as stories são compostas com as
// anotações reais do preview (ThemeProvider oficial + injeção da folha),
// renderizadas (smoke), interações (play) executadas e axe aplicado ao
// canvas de cada story. Escopo do axe = container da story (conteúdo
// portalizado tem cobertura axe dedicada nos testes do pacote).

import { composeStories, setProjectAnnotations } from '@storybook/react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { describe, expect, it } from 'vitest';

import preview from '../.storybook/preview';

setProjectAnnotations([preview]);

// glue de tipagem localizado: os módulos vêm de glob dinâmico e a composição
// devolve componentes renderizáveis com play opcional (API pública do SB).
type ComposedStory = React.ComponentType & {
  readonly play?: (context: { canvasElement: HTMLElement }) => Promise<void>;
};
type StoryModule = Parameters<typeof composeStories>[0];
const modules = import.meta.glob('../stories/**/*.stories.tsx', { eager: true });
const moduleEntries = Object.entries(modules) as [string, StoryModule][];

function compose(module: StoryModule): Record<string, ComposedStory> {
  return composeStories(module) as unknown as Record<string, ComposedStory>;
}

describe('catálogo de stories', () => {
  it('todas as famílias possuem módulos de stories', () => {
    const families = [
      'foundation',
      'primitives',
      'forms',
      'feedback',
      'navigation',
      'layouts',
      'patterns',
    ];
    for (const family of families) {
      expect(
        moduleEntries.some(([path]) => path.includes(`/${family}/`)),
        `família sem stories: ${family}`,
      ).toBe(true);
    }
  });

  it('todo módulo tem meta com title e ao menos uma story', () => {
    for (const [path, module] of moduleEntries) {
      const names = Object.keys(compose(module));
      expect(names.length, `sem stories em ${path}`).toBeGreaterThan(0);
    }
  });
});

for (const [path, module] of moduleEntries) {
  const composed = compose(module);
  describe(path.replace('../stories/', ''), () => {
    for (const [name, Story] of Object.entries(composed)) {
      it(`${name}: renderiza com o preview real, executa play e passa no axe`, async () => {
        const { container, unmount } = render(<Story />);
        try {
          if (Story.play !== undefined) {
            await Story.play({ canvasElement: container });
          }
          expect((await axe(container)).violations).toEqual([]);
        } finally {
          unmount();
        }
      });
    }
  });
}
