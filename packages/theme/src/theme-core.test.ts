// Testes das partes puras: resolver, storage, sistema, adapter DOM e script.

import { describe, expect, it, vi } from 'vitest';

import { core, darkTheme, lightTheme } from '@tauros/tokens';

import { buildInitialThemeScript } from './initial-theme-script.js';
import { browserSystemPreferences, staticSystemPreferences } from './system-preferences.js';
import { createThemeDomAdapter } from './theme-dom-adapter.js';
import { resolveEffectiveTheme, resolveModes } from './theme-resolver.js';
import {
  localStoragePreferenceStorage,
  safeLoadPreferences,
  safeSavePreferences,
  validatePreferences,
  type PreferenceStoragePort,
} from './theme-storage.js';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SYSTEM_SNAPSHOT,
  PREFERENCES_STORAGE_KEY,
  type ThemePreferences,
} from './theme-types.js';

const SYSTEM_DARK = { ...DEFAULT_SYSTEM_SNAPSHOT, prefersDark: true };

function prefs(overrides: Partial<ThemePreferences> = {}): ThemePreferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

describe('resolução (preferência + sistema → tema efetivo)', () => {
  it('light explícito ignora sistema dark', () => {
    const e = resolveEffectiveTheme(prefs({ colorScheme: 'light' }), SYSTEM_DARK);
    expect(e.colorScheme).toBe('light');
    expect(e.theme.color.surface.app).toBe(lightTheme.color.surface.app);
  });

  it('system segue o sistema (dark)', () => {
    const e = resolveEffectiveTheme(prefs({ colorScheme: 'system' }), SYSTEM_DARK);
    expect(e.colorScheme).toBe('dark');
    expect(e.theme.color.surface.app).toBe(darkTheme.color.surface.app);
    expect(e.attributes['data-theme']).toBe('dark');
  });

  it('reducedMotion "system" segue o sistema; explícito false ignora', () => {
    const system = { ...DEFAULT_SYSTEM_SNAPSHOT, prefersReducedMotion: true };
    const auto = resolveEffectiveTheme(prefs(), system);
    expect(auto.modes).toContain('reducedMotion');
    expect(auto.theme.motion.enter.duration).toBe('0ms');
    expect(auto.attributes['data-motion']).toBe('reduced');

    const off = resolveEffectiveTheme(
      prefs({ modes: { ...DEFAULT_PREFERENCES.modes, reducedMotion: false } }),
      system,
    );
    expect(off.modes).not.toContain('reducedMotion');
  });

  it('industrial implica contraste alto; glove eleva o alvo (72px)', () => {
    const e = resolveEffectiveTheme(
      prefs({
        modes: { highContrast: false, industrial: true, glove: true, reducedMotion: false },
      }),
      DEFAULT_SYSTEM_SNAPSHOT,
    );
    expect(e.attributes['data-contrast']).toBe('high');
    expect(e.attributes['data-environment']).toBe('industrial');
    expect(e.attributes['data-input-mode']).toBe('glove');
    expect(e.theme.size.controlMin).toBe(core.touch.glovePlus);
  });

  it('prefers-contrast do sistema ativa highContrast sem sobrescrever explícitos', () => {
    const system = { ...DEFAULT_SYSTEM_SNAPSHOT, prefersHighContrast: true };
    expect(resolveModes(prefs(), system)).toContain('highContrast');
  });

  it('combinação é determinística', () => {
    const p = prefs({
      colorScheme: 'dark',
      modes: { highContrast: false, industrial: true, glove: true, reducedMotion: true },
    });
    expect(resolveEffectiveTheme(p, DEFAULT_SYSTEM_SNAPSHOT)).toEqual(
      resolveEffectiveTheme(p, DEFAULT_SYSTEM_SNAPSHOT),
    );
  });
});

describe('storage blindado (§9/§14)', () => {
  const valid = { version: 1, preferences: prefs({ colorScheme: 'dark' }) };

  it('carrega valor válido e descarta propriedades desconhecidas', () => {
    const raw = {
      ...valid,
      preferences: { ...valid.preferences, injected: 'malicioso' },
    };
    const loaded = validatePreferences(raw)!;
    expect(loaded.colorScheme).toBe('dark');
    expect('injected' in loaded).toBe(false);
  });

  it('rejeita versão desconhecida, corrompidos e valores maliciosos', () => {
    expect(validatePreferences({ version: 2, preferences: valid.preferences })).toBeNull();
    expect(validatePreferences('garbage')).toBeNull();
    expect(validatePreferences({ version: 1, preferences: { colorScheme: 'hack' } })).toBeNull();
    expect(
      validatePreferences({
        version: 1,
        preferences: { colorScheme: 'dark', modes: { highContrast: 'yes' } },
      }),
    ).toBeNull();
  });

  it('leitura que lança ⇒ defaults; escrita que lança ⇒ silêncio', () => {
    const broken: PreferenceStoragePort = {
      read: () => {
        throw new Error('bloqueado');
      },
      write: () => {
        throw new Error('bloqueado');
      },
    };
    expect(safeLoadPreferences(broken)).toEqual(DEFAULT_PREFERENCES);
    expect(() => safeSavePreferences(broken, DEFAULT_PREFERENCES)).not.toThrow();
  });

  it('localStorage: roundtrip e SSR-safe (sem window ⇒ null/no-op)', () => {
    const storage = localStoragePreferenceStorage();
    safeSavePreferences(storage, prefs({ colorScheme: 'dark' }));
    expect(safeLoadPreferences(storage).colorScheme).toBe('dark');
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);

    const w = globalThis.window;
    vi.stubGlobal('window', undefined);
    try {
      const ssr = localStoragePreferenceStorage();
      expect(ssr.read()).toBeNull();
      expect(() => ssr.write({})).not.toThrow();
    } finally {
      vi.stubGlobal('window', w);
    }
  });
});

describe('preferências do sistema (§8)', () => {
  it('sem matchMedia ⇒ snapshot default e subscribe no-op', () => {
    const w = globalThis.window;
    vi.stubGlobal('window', undefined);
    try {
      const port = browserSystemPreferences();
      expect(port.get()).toEqual(DEFAULT_SYSTEM_SNAPSHOT);
      expect(() => port.subscribe(() => undefined)()).not.toThrow();
    } finally {
      vi.stubGlobal('window', w);
    }
  });

  it('porta estática entrega o snapshot fixo', () => {
    expect(staticSystemPreferences(SYSTEM_DARK).get()).toBe(SYSTEM_DARK);
  });
});

describe('adapter DOM (§4/§5)', () => {
  it('aplica vars/atributos, curto-circuita idênticos e faz diff no update', () => {
    const root = document.createElement('div');
    const spy = vi.spyOn(root.style, 'setProperty');
    const adapter = createThemeDomAdapter(root);

    const light = resolveEffectiveTheme(prefs({ colorScheme: 'light' }), DEFAULT_SYSTEM_SNAPSHOT);
    adapter.update(light.theme, light.attributes);
    const initialWrites = spy.mock.calls.length;
    expect(initialWrites).toBeGreaterThan(80);
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.style.getPropertyValue('--tauros-color-surface-app')).toBe(
      lightTheme.color.surface.app,
    );

    // idêntico ⇒ nenhuma escrita nova (§5)
    adapter.update(light.theme, light.attributes);
    expect(spy.mock.calls.length).toBe(initialWrites);

    // dark ⇒ só o delta é reescrito (bem menos que o total)
    const dark = resolveEffectiveTheme(prefs({ colorScheme: 'dark' }), DEFAULT_SYSTEM_SNAPSHOT);
    adapter.update(dark.theme, dark.attributes);
    const deltaWrites = spy.mock.calls.length - initialWrites;
    expect(deltaWrites).toBeGreaterThan(0);
    expect(deltaWrites).toBeLessThan(initialWrites / 2);
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('cleanup remove somente o que aplicou (atributos alheios ficam)', () => {
    const root = document.createElement('div');
    root.setAttribute('data-app', 'tauros');
    const adapter = createThemeDomAdapter(root);
    const e = resolveEffectiveTheme(prefs(), DEFAULT_SYSTEM_SNAPSHOT);
    adapter.update(e.theme, e.attributes);
    adapter.cleanup();
    expect(root.getAttribute('data-theme')).toBeNull();
    expect(root.style.getPropertyValue('--tauros-color-surface-app')).toBe('');
    expect(root.getAttribute('data-app')).toBe('tauros');
    expect(adapter.appliedSignature()).toBeNull();
  });
});

describe('script inicial anti-flash (§7/§14)', () => {
  it('é pequeno, sem eval, valida storage e falha em silêncio', () => {
    const script = buildInitialThemeScript();
    expect(script.length).toBeLessThan(1600);
    expect(script).not.toContain('eval');
    expect(script).not.toContain('Function(');
    expect(script).toContain(PREFERENCES_STORAGE_KEY);
    expect(script).toContain('try');
    expect(script).toContain('catch');
  });

  it('define os atributos corretos quando executado (JSDOM)', () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        preferences: prefs({
          colorScheme: 'dark',
          modes: { highContrast: false, industrial: true, glove: true, reducedMotion: false },
        }),
      }),
    );
    // Execução controlada do NOSSO artefato estático em ambiente de teste.
    // (O script em produção é servido como <script>; nunca há eval no runtime.)
    new Function(buildInitialThemeScript())();

    const d = document.documentElement;
    expect(d.getAttribute('data-theme')).toBe('dark');
    expect(d.getAttribute('data-environment')).toBe('industrial');
    expect(d.getAttribute('data-input-mode')).toBe('glove');
    expect(d.getAttribute('data-contrast')).toBe('high');
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    for (const a of [
      'data-theme',
      'data-contrast',
      'data-environment',
      'data-input-mode',
      'data-motion',
    ])
      d.removeAttribute(a);
  });

  it('storage malicioso não quebra a execução', () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{{{nao-e-json');
    expect(() => new Function(buildInitialThemeScript())()).not.toThrow();
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  });
});
