// Core Tokens (5.2-B §1) — primitivos SEM significado. Nenhum componente
// consome esta camada diretamente (regra dura da arquitetura de tokens).
// Fonte agnóstica: valores unitless/rem; a transformação por alvo decide
// a unidade final (Ajuste 3 — multiplataforma).

export const core = {
  color: {
    /** Neutros com viés quente (identidade Tauros). */
    neutral: {
      0: '#FFFFFF',
      50: '#FAF8F5',
      100: '#F4F0EA',
      200: '#E4DDD2',
      300: '#D8CDBB',
      400: '#B7AB9A',
      500: '#8A8079',
      600: '#5B534E',
      700: '#3A3430',
      800: '#23201E',
      900: '#16130F',
    },
    /** Marca (oxblood). */
    brand: { 300: '#D07784', 400: '#A83B4A', 500: '#8B2635', 600: '#75202C' },
    green: {
      300: '#7CA98A',
      400: '#4E8062',
      500: '#3F6B4E',
      600: '#2F5A42',
      container: '#E6EEE8',
      containerDark: '#1D2A22',
    },
    amber: {
      300: '#D6A24C',
      400: '#B7801F',
      500: '#98600F',
      600: '#7A4E0C',
      container: '#F3E9D6',
      containerDark: '#2C2416',
    },
    red: {
      300: '#E08A82',
      400: '#C2453B',
      500: '#A3312A',
      600: '#862722',
      container: '#F5E4E1',
      containerDark: '#2E1B18',
    },
    blue: {
      300: '#8FB6CE',
      400: '#3E6E90',
      500: '#345E7A',
      600: '#274A61',
      container: '#E4EDF2',
      containerDark: '#182530',
    },
  },

  type: {
    family: {
      sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      mono: "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'Liberation Mono', monospace",
      display: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
    },
    size: {
      100: '0.75rem',
      200: '0.875rem',
      300: '1rem',
      400: '1.125rem',
      500: '1.25rem',
      600: '1.5rem',
      700: '1.875rem',
      800: '2.25rem',
      900: '3rem',
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    leading: { tight: 1.1, snug: 1.3, normal: 1.5, relaxed: 1.6 },
  },

  /** Grade de 4px. */
  space: {
    0: '0',
    25: '0.125rem',
    50: '0.25rem',
    100: '0.5rem',
    150: '0.75rem',
    200: '1rem',
    300: '1.5rem',
    400: '2rem',
    500: '2.5rem',
    600: '3rem',
    800: '4rem',
    1000: '5rem',
  },

  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    pill: '999px',
    circle: '50%',
  },

  /** Elevação abstrata (web = sombra; RN = elevation; impressão = borda). */
  shadow: {
    0: 'none',
    1: '0 1px 2px rgba(22, 19, 15, 0.06)',
    2: '0 1px 2px rgba(22, 19, 15, 0.05), 0 8px 24px rgba(22, 19, 15, 0.08)',
    3: '0 2px 4px rgba(22, 19, 15, 0.08), 0 16px 40px rgba(22, 19, 15, 0.12)',
    4: '0 4px 8px rgba(22, 19, 15, 0.10), 0 24px 56px rgba(22, 19, 15, 0.16)',
  },

  opacity: { disabled: 0.45, muted: 0.7, overlay: 0.5, full: 1 },

  z: {
    base: 0,
    raised: 10,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1200,
    sheet: 1300,
    dialog: 1400,
    toast: 1500,
  },

  motion: {
    duration: { instant: '0ms', fast: '120ms', base: '200ms', slow: '320ms', deliberate: '480ms' },
    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      decelerate: 'cubic-bezier(0, 0, 0, 1)',
      accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
      emphasized: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
    },
  },

  breakpoint: { mobile: '0px', tablet: '768px', desktop: '1280px', wide: '1600px' },

  /** Alvos de toque (Design Language P4 — glove-first). */
  touch: { min: '48px', comfortable: '56px', glove: '64px', glovePlus: '72px' },

  density: { compact: 0.85, default: 1, comfortable: 1.15 },
} as const;

export type CoreTokens = typeof core;
