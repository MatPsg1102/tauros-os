// Storybook (6.3.8) — contrato executável do Design System.
// Stories vivem NO APP (consumidor externo): importam somente os exports
// públicos dos pacotes (o `exports` de @tauros/ui-primitives bloqueia deep
// imports; regra depcruise reforça). Addons mínimos com valor arquitetural.

import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: { name: '@storybook/react-vite', options: {} },
  docs: { defaultName: 'Documentação' },
  typescript: { reactDocgen: 'react-docgen-typescript' },
};

export default config;
