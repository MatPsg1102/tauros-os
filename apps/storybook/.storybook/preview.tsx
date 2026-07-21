// Preview oficial (6.3.8) — integra o ThemeProvider PÚBLICO e a folha oficial
// (injeção explícita e idempotente — nenhum side effect de import no pacote).
// Toolbar de modos = os MESMOS runtime modes da aplicação (nenhum estado
// paralelo): as escolhas viram ThemePreferences reais; storage = noop
// (Storybook em modo controlado, sem acesso a storage); sistema = estático
// (determinístico). Viewports operacionais derivados de core.breakpoint.

import type { Decorator, Preview } from '@storybook/react';
import React from 'react';

import { core } from '@tauros/tokens';
import {
  DEFAULT_PREFERENCES,
  noopPreferenceStorage,
  staticSystemPreferences,
  ThemeProvider,
  type ThemePreferences,
} from '@tauros/theme';
import { injectUiStyles } from '@tauros/ui-primitives';

const bpToPx = (value: string): number => Number.parseInt(value, 10);

/** Viewports operacionais (largura de breakpoint tokenizada onde aplicável). */
const OPERATIONAL_VIEWPORTS = {
  mobileCompact: {
    name: 'Mobile compacto (320)',
    styles: { width: '320px', height: '568px' },
  },
  mobileStandard: {
    name: 'Mobile padrão (390)',
    styles: { width: '390px', height: '844px' },
  },
  tabletPortrait: {
    name: `Tablet retrato (${String(bpToPx(core.breakpoint.tablet))})`,
    styles: { width: core.breakpoint.tablet, height: '1024px' },
  },
  tabletLandscape: {
    name: 'Tablet paisagem (1024)',
    styles: { width: '1024px', height: core.breakpoint.tablet },
  },
  desktopStandard: {
    name: `Desktop padrão (${String(bpToPx(core.breakpoint.desktop))})`,
    styles: { width: core.breakpoint.desktop, height: '800px' },
  },
  desktopWide: {
    name: `Desktop amplo (${String(bpToPx(core.breakpoint.wide))})`,
    styles: { width: core.breakpoint.wide, height: '900px' },
  },
};

function preferencesFromGlobals(globals: Record<string, unknown>): ThemePreferences {
  const scheme = globals['scheme'] === 'dark' ? 'dark' : 'light';
  const contrast = globals['contrast'];
  const input = globals['input'];
  const motion = globals['motion'];
  return {
    ...DEFAULT_PREFERENCES,
    colorScheme: scheme,
    modes: {
      highContrast: contrast === 'high',
      industrial: contrast === 'industrial',
      glove: input === 'glove',
      reducedMotion: motion === 'reduced',
    },
  };
}

const withTaurosTheme: Decorator = (Story, context) => {
  // injeção explícita da folha oficial — idempotente entre trocas de história
  injectUiStyles(document);
  const preferences = preferencesFromGlobals(context.globals);
  return (
    <ThemeProvider
      // remonta o provider por combinação de modos: atributos/vars sempre limpos
      key={JSON.stringify(preferences)}
      defaultPreferences={preferences}
      storage={noopPreferenceStorage}
      systemPreferences={staticSystemPreferences()}
    >
      <Story />
    </ThemeProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    scheme: {
      description: 'Esquema de cor',
      toolbar: {
        title: 'Cor',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    contrast: {
      description: 'Contraste/ambiente',
      toolbar: {
        title: 'Contraste',
        icon: 'contrast',
        items: [
          { value: 'default', title: 'Padrão' },
          { value: 'high', title: 'Alto contraste' },
          { value: 'industrial', title: 'Industrial' },
        ],
        dynamicTitle: true,
      },
    },
    input: {
      description: 'Modo de entrada',
      toolbar: {
        title: 'Entrada',
        icon: 'button',
        items: [
          { value: 'default', title: 'Padrão' },
          { value: 'glove', title: 'Luvas (glove)' },
        ],
        dynamicTitle: true,
      },
    },
    motion: {
      description: 'Movimento',
      toolbar: {
        title: 'Movimento',
        icon: 'timer',
        items: [
          { value: 'default', title: 'Padrão' },
          { value: 'reduced', title: 'Reduzido' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { scheme: 'light', contrast: 'default', input: 'default', motion: 'default' },
  decorators: [withTaurosTheme],
  parameters: {
    layout: 'padded',
    viewport: { viewports: OPERATIONAL_VIEWPORTS },
    controls: { expanded: false },
    a11y: { test: 'error' },
    options: {
      storySort: {
        order: [
          'Foundation',
          'Primitives',
          'Forms',
          'Feedback',
          'Navigation',
          'Layouts',
          'Patterns',
        ],
      },
    },
  },
  tags: ['autodocs'],
};

export default preview;
