// ThemeProvider (6.3.2) — resolve, aplica e disponibiliza o tema.
// NUNCA cria tokens nem valores visuais: tudo vem de @tauros/tokens.
// SSR-safe: nenhuma API de navegador durante o render; DOM só em efeitos.

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { resolveEffectiveTheme } from './theme-resolver.js';
import { createThemeDomAdapter, type AppliedThemeHandle } from './theme-dom-adapter.js';
import { ThemeContext, type ThemeContextValue } from './theme-context.js';
import { NestedThemeProviderError } from './theme-errors.js';
import { browserSystemPreferences, type SystemPreferencesPort } from './system-preferences.js';
import {
  localStoragePreferenceStorage,
  safeLoadPreferences,
  safeSavePreferences,
  type PreferenceStoragePort,
} from './theme-storage.js';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SYSTEM_SNAPSHOT,
  type ColorSchemePreference,
  type RuntimeModePreferences,
  type SystemPreferencesSnapshot,
  type ThemePreferences,
} from './theme-types.js';

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Preferências iniciais quando não há valor persistido válido. */
  readonly defaultPreferences?: ThemePreferences;
  /** Porta de persistência (default: localStorage SSR-safe). */
  readonly storage?: PreferenceStoragePort;
  /** Porta de preferências do sistema (default: matchMedia SSR-safe). */
  readonly systemPreferences?: SystemPreferencesPort;
  /**
   * Root que recebe CSS variables e atributos. Default: documentElement.
   * Providers ANINHADOS exigem target próprio (§11) — sem ele, erro orientado.
   */
  readonly target?: HTMLElement;
  /** Callback opcional de mudança de preferência (§15 — sem dados sensíveis). */
  readonly onPreferenceChange?: (preferences: ThemePreferences) => void;
}

export function ThemeProvider(props: ThemeProviderProps): ReactNode {
  const {
    children,
    defaultPreferences = DEFAULT_PREFERENCES,
    storage,
    systemPreferences,
    target,
    onPreferenceChange,
  } = props;

  // §11: aninhamento só com root próprio e explícito.
  const parent = useContext(ThemeContext);
  if (parent !== null && target === undefined) {
    throw new NestedThemeProviderError();
  }

  // Portas estáveis por instância (defaults criados uma única vez).
  const storageRef = useRef<PreferenceStoragePort | null>(null);
  storageRef.current ??= storage ?? localStoragePreferenceStorage();
  const systemRef = useRef<SystemPreferencesPort | null>(null);
  systemRef.current ??= systemPreferences ?? browserSystemPreferences();

  // Preferências: storage validado → default. Leitura síncrona é segura
  // (portas são SSR-safe por contrato e blindadas contra exceção).
  const [preferences, setPreferences] = useState<ThemePreferences>(() => {
    const loaded = safeLoadPreferences(storageRef.current!);
    return loaded === DEFAULT_PREFERENCES ? defaultPreferences : loaded;
  });

  // Sistema: snapshot default no servidor; sincroniza no cliente pós-mount
  // (evita divergência servidor/navegador na hidratação — §6).
  const [system, setSystem] = useState<SystemPreferencesSnapshot>(DEFAULT_SYSTEM_SNAPSHOT);
  useEffect(() => {
    const port = systemRef.current!;
    setSystem(port.get());
    return port.subscribe(setSystem);
  }, []);

  // Tema efetivo — derivação pura e memoizada (§12).
  const effective = useMemo(
    () => resolveEffectiveTheme(preferences, system),
    [preferences, system],
  );

  // Aplicação no DOM (efeito; nunca no render — §6). Um adapter por root.
  const handleRef = useRef<AppliedThemeHandle | null>(null);
  useEffect(() => {
    const root = target ?? (typeof document !== 'undefined' ? document.documentElement : null);
    if (root === null) return;
    handleRef.current ??= createThemeDomAdapter(root);
    handleRef.current.update(effective.theme, effective.attributes);
  }, [effective, target]);

  // Cleanup no unmount: remove somente o que aplicamos (§5).
  useEffect(
    () => () => {
      handleRef.current?.cleanup();
      handleRef.current = null;
    },
    [],
  );

  const persist = useCallback(
    (next: ThemePreferences) => {
      setPreferences(next);
      safeSavePreferences(storageRef.current!, next);
      onPreferenceChange?.(next);
    },
    [onPreferenceChange],
  );

  const setColorScheme = useCallback(
    (scheme: ColorSchemePreference) => {
      setPreferences((current) => {
        const next = { ...current, colorScheme: scheme };
        safeSavePreferences(storageRef.current!, next);
        onPreferenceChange?.(next);
        return next;
      });
    },
    [onPreferenceChange],
  );

  const setMode = useCallback(
    <K extends keyof RuntimeModePreferences>(mode: K, value: RuntimeModePreferences[K]) => {
      setPreferences((current) => {
        const next = { ...current, modes: { ...current.modes, [mode]: value } };
        safeSavePreferences(storageRef.current!, next);
        onPreferenceChange?.(next);
        return next;
      });
    },
    [onPreferenceChange],
  );

  const resetPreferences = useCallback(() => {
    persist(defaultPreferences);
  }, [persist, defaultPreferences]);

  // §12: estabilidade referencial — só muda quando algo relevante muda.
  const value = useMemo<ThemeContextValue>(
    () => ({
      preferences,
      resolvedTheme: effective.theme,
      modes: effective.modes,
      setColorScheme,
      setMode,
      resetPreferences,
    }),
    [preferences, effective, setColorScheme, setMode, resetPreferences],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
