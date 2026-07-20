// Testes comportamentais do ThemeProvider (React Testing Library + JSDOM).

import { act, cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { core } from '@tauros/tokens';

import { staticSystemPreferences, type SystemPreferencesPort } from './system-preferences.js';
import { useTheme, type ThemeContextValue } from './theme-context.js';
import { NestedThemeProviderError, ThemeProviderMissingError } from './theme-errors.js';
import { ThemeProvider } from './theme-provider.js';
import { noopPreferenceStorage, type PreferenceStoragePort } from './theme-storage.js';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SYSTEM_SNAPSHOT,
  PREFERENCES_VERSION,
  type SystemPreferencesSnapshot,
} from './theme-types.js';

afterEach(() => {
  cleanup();
});

/** Porta de sistema mutável com notificação (simula matchMedia). */
function mutableSystem(initial: SystemPreferencesSnapshot): {
  port: SystemPreferencesPort;
  set(next: SystemPreferencesSnapshot): void;
} {
  let snapshot = initial;
  const listeners = new Set<(s: SystemPreferencesSnapshot) => void>();
  return {
    port: {
      get: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    set(next) {
      snapshot = next;
      for (const l of listeners) l(next);
    },
  };
}

function memoryStorage(initial: unknown = null): PreferenceStoragePort & { data: unknown } {
  const box = { data: initial as unknown };
  return {
    get data() {
      return box.data;
    },
    read: () => box.data,
    write(v) {
      box.data = v;
    },
  } as PreferenceStoragePort & { data: unknown };
}

/** Captura o valor do contexto sem UI acoplada. */
function Capture(props: { onValue(v: ThemeContextValue): void }): null {
  props.onValue(useTheme());
  return null;
}

function renderProvider(
  options: {
    storage?: PreferenceStoragePort;
    system?: SystemPreferencesPort;
    target?: HTMLElement;
  } = {},
) {
  const target = options.target ?? document.createElement('div');
  let latest: ThemeContextValue | null = null;
  const utils = render(
    <ThemeProvider
      storage={options.storage ?? noopPreferenceStorage}
      systemPreferences={options.system ?? staticSystemPreferences()}
      target={target}
    >
      <Capture onValue={(v) => (latest = v)} />
    </ThemeProvider>,
  );
  return { target, utils, value: () => latest! };
}

describe('ThemeProvider — temas e sistema', () => {
  it('renderiza claro por default e aplica vars + data-attrs no root customizado', () => {
    const { target, value } = renderProvider();
    expect(value().resolvedTheme.name).toBe('light');
    expect(target.getAttribute('data-theme')).toBe('light');
    expect(target.style.getPropertyValue('--tauros-size-control-min')).toBe(core.touch.glove);
  });

  it('preferência dark explícita aplica dark', () => {
    const { target, value } = renderProvider();
    act(() => value().setColorScheme('dark'));
    expect(target.getAttribute('data-theme')).toBe('dark');
    expect(value().resolvedTheme.color.surface.app).toBe(core.color.neutral[900]);
  });

  it('system: segue o sistema e reage à mudança do sistema', () => {
    const sys = mutableSystem(DEFAULT_SYSTEM_SNAPSHOT);
    const { target } = renderProvider({ system: sys.port });
    expect(target.getAttribute('data-theme')).toBe('light');
    act(() => sys.set({ ...DEFAULT_SYSTEM_SNAPSHOT, prefersDark: true }));
    expect(target.getAttribute('data-theme')).toBe('dark');
  });

  it('preferência explícita NÃO é sobrescrita por mudança do sistema', () => {
    const sys = mutableSystem(DEFAULT_SYSTEM_SNAPSHOT);
    const { target, value } = renderProvider({ system: sys.port });
    act(() => value().setColorScheme('light'));
    act(() => sys.set({ ...DEFAULT_SYSTEM_SNAPSHOT, prefersDark: true }));
    expect(target.getAttribute('data-theme')).toBe('light');
  });

  it('modos: glove/industrial/reducedMotion aplicam atributos e tokens', () => {
    const { target, value } = renderProvider();
    act(() => value().setMode('glove', true));
    act(() => value().setMode('industrial', true));
    act(() => value().setMode('reducedMotion', true));
    expect(target.getAttribute('data-input-mode')).toBe('glove');
    expect(target.getAttribute('data-environment')).toBe('industrial');
    expect(target.getAttribute('data-motion')).toBe('reduced');
    expect(target.style.getPropertyValue('--tauros-size-control-min')).toBe(core.touch.glovePlus);
    expect(target.style.getPropertyValue('--tauros-motion-enter-duration')).toBe('0ms');
  });

  it('reducedMotion via sistema quando preferência é "system"', () => {
    const sys = mutableSystem({ ...DEFAULT_SYSTEM_SNAPSHOT, prefersReducedMotion: true });
    const { target } = renderProvider({ system: sys.port });
    expect(target.getAttribute('data-motion')).toBe('reduced');
  });
});

describe('ThemeProvider — storage e preferências', () => {
  it('carrega preferências persistidas válidas', () => {
    const storage = memoryStorage({
      version: PREFERENCES_VERSION,
      preferences: { ...DEFAULT_PREFERENCES, colorScheme: 'dark' },
    });
    const { target } = renderProvider({ storage });
    expect(target.getAttribute('data-theme')).toBe('dark');
  });

  it('storage corrompido/bloqueado cai em defaults sem quebrar', () => {
    const broken: PreferenceStoragePort = {
      read: () => {
        throw new Error('bloqueado');
      },
      write: () => {
        throw new Error('bloqueado');
      },
    };
    const { target, value } = renderProvider({ storage: broken });
    expect(target.getAttribute('data-theme')).toBe('light');
    expect(() => act(() => value().setColorScheme('dark'))).not.toThrow();
    expect(target.getAttribute('data-theme')).toBe('dark');
  });

  it('setColorScheme persiste; resultado resolvido NUNCA é persistido', () => {
    const storage = memoryStorage();
    const { value } = renderProvider({ storage });
    act(() => value().setColorScheme('dark'));
    const persisted = storage.data as { version: number; preferences: { colorScheme: string } };
    expect(persisted.version).toBe(PREFERENCES_VERSION);
    expect(persisted.preferences.colorScheme).toBe('dark');
    expect(JSON.stringify(persisted)).not.toContain('--tauros');
    expect(JSON.stringify(persisted)).not.toContain('#');
  });

  it('resetPreferences volta aos defaults e persiste', () => {
    const storage = memoryStorage();
    const { target, value } = renderProvider({ storage });
    act(() => value().setColorScheme('dark'));
    act(() => value().resetPreferences());
    expect(target.getAttribute('data-theme')).toBe('light');
    expect((storage.data as { preferences: { colorScheme: string } }).preferences.colorScheme).toBe(
      'system',
    );
  });
});

describe('ThemeProvider — DOM, cleanup e estabilidade', () => {
  it('sem mudança de tema resolvido não há reescrita de vars', () => {
    const target = document.createElement('div');
    const spy = vi.spyOn(target.style, 'setProperty');
    const { value } = renderProvider({ target });
    const after = spy.mock.calls.length;
    // set para o MESMO esquema não muda o tema resolvido
    act(() => value().setColorScheme('light'));
    expect(spy.mock.calls.length).toBe(after);
  });

  it('unmount limpa vars e atributos do root', () => {
    const { target, utils } = renderProvider();
    expect(target.getAttribute('data-theme')).toBe('light');
    utils.unmount();
    expect(target.getAttribute('data-theme')).toBeNull();
    expect(target.style.getPropertyValue('--tauros-color-surface-app')).toBe('');
  });

  it('estabilidade referencial: re-render sem mudança preserva o value', () => {
    const values: ThemeContextValue[] = [];
    const target = document.createElement('div');
    const system = staticSystemPreferences();
    const capture = (v: ThemeContextValue): void => {
      values.push(v);
    };
    // Elementos NOVOS a cada render (evita bail-out por identidade de elemento),
    // mas com props referencialmente estáveis.
    const makeUi = () => (
      <ThemeProvider storage={noopPreferenceStorage} systemPreferences={system} target={target}>
        <Capture onValue={capture} />
      </ThemeProvider>
    );
    const { rerender } = render(makeUi());
    rerender(makeUi());
    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(values[values.length - 1]).toBe(values[values.length - 2]);
  });
});

describe('ThemeProvider — composição e SSR', () => {
  it('useTheme fora do provider lança erro orientado', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Naked(): null {
      useTheme();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(ThemeProviderMissingError);
    spy.mockRestore();
  });

  it('provider aninhado SEM target lança erro orientado; COM target isola', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const outer = document.createElement('div');
    expect(() =>
      render(
        <ThemeProvider
          storage={noopPreferenceStorage}
          systemPreferences={staticSystemPreferences()}
          target={outer}
        >
          <ThemeProvider
            storage={noopPreferenceStorage}
            systemPreferences={staticSystemPreferences()}
          >
            <span />
          </ThemeProvider>
        </ThemeProvider>,
      ),
    ).toThrow(NestedThemeProviderError);
    spy.mockRestore();

    const inner = document.createElement('div');
    render(
      <ThemeProvider
        storage={noopPreferenceStorage}
        systemPreferences={staticSystemPreferences()}
        target={outer}
      >
        <ThemeProvider
          storage={noopPreferenceStorage}
          systemPreferences={staticSystemPreferences({
            ...DEFAULT_SYSTEM_SNAPSHOT,
            prefersDark: true,
          })}
          defaultPreferences={{ ...DEFAULT_PREFERENCES, colorScheme: 'dark' }}
          target={inner}
        >
          <span />
        </ThemeProvider>
      </ThemeProvider>,
    );
    expect(outer.getAttribute('data-theme')).toBe('light');
    expect(inner.getAttribute('data-theme')).toBe('dark');
  });

  it('SSR: renderToString funciona sem tocar o DOM (efeitos não rodam)', () => {
    const html = renderToString(
      <ThemeProvider storage={noopPreferenceStorage} systemPreferences={staticSystemPreferences()}>
        <main>conteudo</main>
      </ThemeProvider>,
    );
    expect(html).toContain('conteudo');
  });
});
