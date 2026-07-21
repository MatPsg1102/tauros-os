// Cobertura permanente (6.3.9): todo componente público do DS aparece em
// pelo menos uma story (por fonte — mecânico, não por afirmação).

import { describe, expect, it } from 'vitest';

import * as publicApi from '@tauros/ui-primitives';

const sources = Object.values(
  import.meta.glob('../stories/**/*.stories.tsx', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
) as string[];
const all = sources.join('\n');

describe('cobertura de stories por componente público', () => {
  it('todo componente PascalCase exportado é usado em alguma story', () => {
    const components = Object.keys(publicApi).filter(
      (name) => /^[A-Z]/.test(name) && !name.endsWith('Error') && !/^[A-Z_]+$/.test(name),
    );
    const missing = components.filter((name) => !new RegExp(`[<{ ]${name}[ />,}.]`).test(all));
    expect(missing).toEqual([]);
    expect(components.length).toBeGreaterThanOrEqual(88);
  });
});
