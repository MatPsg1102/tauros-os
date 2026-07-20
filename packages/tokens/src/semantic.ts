// Semantic Tokens (5.2-B §2) — significado, referenciando SOMENTE o Core.
// Status é MULTIDIMENSIONAL por construção (P5: cor + forma + ícone) — um
// componente não consegue expressar estado só com cor.

import { core } from './core.js';

/** Formas semânticas de status (P5 — nunca só cor). */
export type StatusShape = 'circle' | 'triangle' | 'square';
export type StatusIcon = 'check' | 'info' | 'warning' | 'error' | 'critical' | 'dot';

export interface StatusToken {
  readonly fg: string;
  readonly bg: string;
  readonly shape: StatusShape;
  readonly icon: StatusIcon;
}

export interface EmphasisLevel {
  readonly size: string;
  readonly weight: number;
  readonly family: string;
}

/** Tema resolvido — a superfície que Runtime rebinda e o ThemeProvider injeta. */
export interface ResolvedTheme {
  readonly name: string;
  readonly color: {
    readonly surface: { readonly app: string; readonly raised: string; readonly sunken: string };
    readonly text: {
      readonly primary: string;
      readonly secondary: string;
      readonly tertiary: string;
      readonly onAccent: string;
    };
    readonly border: { readonly default: string; readonly strong: string; readonly focus: string };
    readonly accent: { readonly default: string; readonly hover: string; readonly pressed: string };
    readonly status: {
      readonly success: StatusToken;
      readonly info: StatusToken;
      readonly warn: StatusToken;
      readonly error: StatusToken;
      readonly critical: StatusToken;
      readonly neutral: StatusToken;
    };
  };
  readonly emphasis: {
    readonly level1: EmphasisLevel;
    readonly level2: EmphasisLevel;
    readonly level3: EmphasisLevel;
    readonly level4: EmphasisLevel;
    readonly level5: EmphasisLevel;
  };
  readonly type: {
    readonly family: typeof core.type.family;
    readonly role: {
      readonly heading: {
        readonly family: string;
        readonly weight: number;
        readonly leading: number;
      };
      readonly body: { readonly family: string; readonly weight: number; readonly leading: number };
      readonly label: {
        readonly family: string;
        readonly weight: number;
        readonly leading: number;
      };
      readonly data: { readonly family: string; readonly weight: number; readonly leading: number };
      readonly caption: {
        readonly family: string;
        readonly weight: number;
        readonly leading: number;
      };
    };
  };
  readonly space: {
    readonly inset: { sm: string; md: string; lg: string };
    readonly gap: typeof core.space;
  };
  readonly radius: { readonly control: string; readonly card: string; readonly pill: string };
  readonly elevation: { readonly card: string; readonly sheet: string; readonly dialog: string };
  readonly size: { readonly controlMin: string };
  readonly opacity: typeof core.opacity;
  readonly z: typeof core.z;
  readonly motion: {
    readonly enter: { readonly duration: string; readonly easing: string };
    readonly exit: { readonly duration: string; readonly easing: string };
    readonly emphasis: { readonly duration: string; readonly easing: string };
  };
  readonly breakpoint: typeof core.breakpoint;
}

/** Tema claro (default) — cada valor referencia o Core (camada respeitada). */
export const lightTheme: ResolvedTheme = {
  name: 'light',
  color: {
    surface: {
      app: core.color.neutral[50],
      raised: core.color.neutral[0],
      sunken: core.color.neutral[100],
    },
    text: {
      primary: core.color.neutral[800],
      secondary: core.color.neutral[600],
      tertiary: core.color.neutral[500],
      onAccent: core.color.neutral[0],
    },
    border: {
      default: core.color.neutral[200],
      strong: core.color.neutral[300],
      focus: core.color.brand[500],
    },
    accent: {
      default: core.color.brand[500],
      hover: core.color.brand[400],
      pressed: core.color.brand[600],
    },
    status: {
      success: {
        fg: core.color.green[500],
        bg: core.color.green.container,
        shape: 'circle',
        icon: 'check',
      },
      info: {
        fg: core.color.blue[500],
        bg: core.color.blue.container,
        shape: 'circle',
        icon: 'info',
      },
      warn: {
        fg: core.color.amber[500],
        bg: core.color.amber.container,
        shape: 'triangle',
        icon: 'warning',
      },
      error: {
        fg: core.color.red[500],
        bg: core.color.red.container,
        shape: 'square',
        icon: 'error',
      },
      critical: {
        fg: core.color.red[600],
        bg: core.color.red.container,
        shape: 'triangle',
        icon: 'critical',
      },
      neutral: {
        fg: core.color.neutral[500],
        bg: core.color.neutral[100],
        shape: 'square',
        icon: 'dot',
      },
    },
  },
  emphasis: {
    level1: {
      size: core.type.size[500],
      weight: core.type.weight.bold,
      family: core.type.family.sans,
    },
    level2: {
      size: core.type.size[400],
      weight: core.type.weight.semibold,
      family: core.type.family.sans,
    },
    level3: {
      size: core.type.size[300],
      weight: core.type.weight.medium,
      family: core.type.family.sans,
    },
    level4: {
      size: core.type.size[200],
      weight: core.type.weight.regular,
      family: core.type.family.sans,
    },
    level5: {
      size: core.type.size[100],
      weight: core.type.weight.regular,
      family: core.type.family.mono,
    },
  },
  type: {
    family: core.type.family,
    role: {
      heading: {
        family: core.type.family.sans,
        weight: core.type.weight.bold,
        leading: core.type.leading.tight,
      },
      body: {
        family: core.type.family.sans,
        weight: core.type.weight.regular,
        leading: core.type.leading.normal,
      },
      label: {
        family: core.type.family.sans,
        weight: core.type.weight.semibold,
        leading: core.type.leading.snug,
      },
      data: {
        family: core.type.family.mono,
        weight: core.type.weight.medium,
        leading: core.type.leading.snug,
      },
      caption: {
        family: core.type.family.sans,
        weight: core.type.weight.regular,
        leading: core.type.leading.snug,
      },
    },
  },
  space: {
    inset: { sm: core.space[100], md: core.space[200], lg: core.space[300] },
    gap: core.space,
  },
  radius: { control: core.radius.md, card: core.radius.lg, pill: core.radius.pill },
  elevation: { card: core.shadow[2], sheet: core.shadow[3], dialog: core.shadow[4] },
  /** Glove-first NO DEFAULT (Design Language P4): 64px, não um modo opcional. */
  size: { controlMin: core.touch.glove },
  opacity: core.opacity,
  z: core.z,
  motion: {
    enter: { duration: core.motion.duration.base, easing: core.motion.easing.decelerate },
    exit: { duration: core.motion.duration.fast, easing: core.motion.easing.accelerate },
    emphasis: { duration: core.motion.duration.slow, easing: core.motion.easing.emphasized },
  },
  breakpoint: core.breakpoint,
};

/** Tema escuro (5.2-B Runtime §6) — mesma estrutura, vínculos rebindados. */
export const darkTheme: ResolvedTheme = {
  ...lightTheme,
  name: 'dark',
  color: {
    surface: {
      app: core.color.neutral[900],
      raised: core.color.neutral[800],
      sunken: core.color.neutral[700],
    },
    text: {
      primary: core.color.neutral[100],
      secondary: core.color.neutral[300],
      tertiary: core.color.neutral[400],
      onAccent: core.color.neutral[0],
    },
    border: {
      default: core.color.neutral[700],
      strong: core.color.neutral[600],
      focus: core.color.brand[300],
    },
    accent: {
      default: core.color.brand[300],
      hover: core.color.brand[400],
      pressed: core.color.brand[500],
    },
    status: {
      success: {
        fg: core.color.green[300],
        bg: core.color.green.containerDark,
        shape: 'circle',
        icon: 'check',
      },
      info: {
        fg: core.color.blue[300],
        bg: core.color.blue.containerDark,
        shape: 'circle',
        icon: 'info',
      },
      warn: {
        fg: core.color.amber[300],
        bg: core.color.amber.containerDark,
        shape: 'triangle',
        icon: 'warning',
      },
      error: {
        fg: core.color.red[300],
        bg: core.color.red.containerDark,
        shape: 'square',
        icon: 'error',
      },
      critical: {
        fg: core.color.red[300],
        bg: core.color.red.containerDark,
        shape: 'triangle',
        icon: 'critical',
      },
      neutral: {
        fg: core.color.neutral[400],
        bg: core.color.neutral[700],
        shape: 'square',
        icon: 'dot',
      },
    },
  },
};
