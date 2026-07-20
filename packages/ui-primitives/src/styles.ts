// Estratégia ÚNICA de estilização (6.3.3 §1): folha CSS estática gerada por
// código, com TODO valor visual vindo de cssVar() (@tauros/tokens).
// - classes estáveis prefixadas `t-`; variantes via data-attributes;
// - zero custo por render (string constante); SSR = injetar a string;
// - reduced-motion/dark/contraste/glove resolvidos pelos PRÓPRIOS tokens
//   (rebinding do ThemeProvider) — sem condicionais React por tema.
// Valores estruturais inevitáveis (display, position, 100%, 1px de borda,
// transparent/currentColor) são os únicos literais — ver allowlist do scanner.

import { cssVar } from '@tauros/tokens';

const v = cssVar;

/** Folha de estilos oficial dos primitivos — determinística. */
export const taurosUiStyles: string = `
/* ===== foco unificado (§17) — alias focusRing dos tokens ===== */
.t-focusable:focus-visible {
  outline: 2px solid ${v('color-border-focus')};
  outline-offset: 2px;
}

/* ===== Text / Heading / Label ===== */
.t-text { margin: 0; }
.t-text[data-role='body'] { font-family: ${v('type-role-body-family')}; font-weight: ${v('type-role-body-weight')}; line-height: ${v('type-role-body-leading')}; }
.t-text[data-role='label'] { font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')}; line-height: ${v('type-role-label-leading')}; }
.t-text[data-role='data'] { font-family: ${v('type-role-data-family')}; font-weight: ${v('type-role-data-weight')}; line-height: ${v('type-role-data-leading')}; font-variant-numeric: tabular-nums; }
.t-text[data-role='caption'] { font-family: ${v('type-role-caption-family')}; font-weight: ${v('type-role-caption-weight')}; line-height: ${v('type-role-caption-leading')}; }
.t-text[data-tone='primary'] { color: ${v('color-text-primary')}; }
.t-text[data-tone='secondary'] { color: ${v('color-text-secondary')}; }
.t-text[data-tone='tertiary'] { color: ${v('color-text-tertiary')}; }

.t-heading { margin: 0; font-family: ${v('type-role-heading-family')}; line-height: ${v('type-role-heading-leading')}; color: ${v('color-text-primary')}; }
.t-heading[data-visual='1'] { font-size: ${v('emphasis-level1-size')}; font-weight: ${v('emphasis-level1-weight')}; }
.t-heading[data-visual='2'] { font-size: ${v('emphasis-level2-size')}; font-weight: ${v('emphasis-level2-weight')}; }
.t-heading[data-visual='3'] { font-size: ${v('emphasis-level3-size')}; font-weight: ${v('emphasis-level3-weight')}; }
.t-heading[data-visual='4'] { font-size: ${v('emphasis-level4-size')}; font-weight: ${v('emphasis-level4-weight')}; }
.t-heading[data-visual='5'] { font-size: ${v('emphasis-level5-size')}; font-weight: ${v('emphasis-level5-weight')}; font-family: ${v('emphasis-level5-family')}; }

/* ===== Divider ===== */
.t-divider { border: none; background: ${v('color-border-default')}; margin: 0; }
.t-divider[data-orientation='horizontal'] { height: 1px; width: 100%; }
.t-divider[data-orientation='vertical'] { width: 1px; align-self: stretch; }

/* ===== Surface / Card ===== */
.t-surface { background: ${v('color-surface-raised')}; color: ${v('color-text-primary')}; }
.t-surface[data-elevation='card'] { box-shadow: ${v('elevation-card')}; border-radius: ${v('radius-card')}; }
.t-surface[data-elevation='sheet'] { box-shadow: ${v('elevation-sheet')}; border-radius: ${v('radius-card')}; }
.t-surface[data-elevation='dialog'] { box-shadow: ${v('elevation-dialog')}; border-radius: ${v('radius-card')}; }
.t-surface[data-elevation='flat'] { border: 1px solid ${v('color-border-default')}; border-radius: ${v('radius-card')}; }
.t-card { padding: ${v('space-inset-lg')}; }

/* ===== Button / IconButton (§6/§7) ===== */
.t-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: ${v('space-gap-100')};
  min-height: ${v('size-control-min')};
  padding-inline: ${v('space-inset-md')};
  border: 1px solid transparent;
  border-radius: ${v('radius-control')};
  font-family: ${v('type-role-label-family')};
  font-weight: ${v('type-role-label-weight')};
  font-size: ${v('emphasis-level3-size')};
  cursor: pointer;
  transition: background-color ${v('motion-enter-duration')} ${v('motion-enter-easing')};
  position: relative;
}
.t-btn[data-size='sm'] { padding-inline: ${v('space-inset-sm')}; font-size: ${v('emphasis-level4-size')}; }
.t-btn[data-size='lg'] { padding-inline: ${v('space-inset-lg')}; font-size: ${v('emphasis-level2-size')}; }
.t-btn[data-full-width='true'] { width: 100%; }
.t-btn[data-variant='primary'] { background: ${v('color-accent-default')}; color: ${v('color-text-on-accent')}; }
.t-btn[data-variant='primary']:hover:not(:disabled) { background: ${v('color-accent-hover')}; }
.t-btn[data-variant='primary']:active:not(:disabled) { background: ${v('color-accent-pressed')}; }
.t-btn[data-variant='secondary'] { background: transparent; color: ${v('color-text-primary')}; border-color: ${v('color-border-strong')}; }
.t-btn[data-variant='secondary']:hover:not(:disabled) { background: ${v('color-surface-sunken')}; }
.t-btn[data-variant='ghost'] { background: transparent; color: ${v('color-text-primary')}; }
.t-btn[data-variant='ghost']:hover:not(:disabled) { background: ${v('color-surface-sunken')}; }
.t-btn[data-variant='danger'] { background: ${v('color-status-error-fg')}; color: ${v('color-text-on-accent')}; }
.t-btn[data-variant='danger']:hover:not(:disabled) { background: ${v('color-status-critical-fg')}; }
.t-btn:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-btn[data-loading='true'] .t-btn-content { visibility: hidden; }
.t-btn[data-loading='true'] .t-btn-spinner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.t-iconbtn { min-width: ${v('size-control-min')}; padding-inline: 0; }

/* ===== Badge (status multidimensional — P5) ===== */
.t-badge {
  display: inline-flex; align-items: center; gap: ${v('space-gap-50')};
  padding-inline: ${v('space-gap-100')};
  border-radius: ${v('radius-pill')};
  font-family: ${v('type-role-caption-family')};
  font-size: ${v('emphasis-level5-size')};
  font-weight: ${v('type-role-label-weight')};
}
.t-badge[data-status='success'] { color: ${v('color-status-success-fg')}; background: ${v('color-status-success-bg')}; }
.t-badge[data-status='info'] { color: ${v('color-status-info-fg')}; background: ${v('color-status-info-bg')}; }
.t-badge[data-status='warn'] { color: ${v('color-status-warn-fg')}; background: ${v('color-status-warn-bg')}; }
.t-badge[data-status='error'] { color: ${v('color-status-error-fg')}; background: ${v('color-status-error-bg')}; }
.t-badge[data-status='critical'] { color: ${v('color-status-critical-fg')}; background: ${v('color-status-critical-bg')}; }
.t-badge[data-status='neutral'] { color: ${v('color-status-neutral-fg')}; background: ${v('color-status-neutral-bg')}; }
.t-badge-marker { width: ${v('space-gap-100')}; height: ${v('space-gap-100')}; background: currentColor; flex-shrink: 0; }
.t-badge-marker[data-shape='circle'] { border-radius: ${v('radius-pill')}; }
.t-badge-marker[data-shape='square'] { border-radius: 0; }
.t-badge-marker[data-shape='triangle'] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }

/* ===== Chip ===== */
.t-chip {
  display: inline-flex; align-items: center; gap: ${v('space-gap-50')};
  min-height: ${v('size-control-min')};
  padding-inline: ${v('space-inset-sm')};
  border-radius: ${v('radius-pill')};
  border: 1px solid ${v('color-border-default')};
  background: ${v('color-surface-sunken')};
  color: ${v('color-text-primary')};
  font-family: ${v('type-role-label-family')};
  font-size: ${v('emphasis-level4-size')};
  cursor: pointer;
}
.t-chip[aria-pressed='true'] { background: ${v('color-accent-default')}; color: ${v('color-text-on-accent')}; border-color: transparent; }
.t-chip:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-chip-remove { display: inline-flex; align-items: center; justify-content: center; border: none; background: transparent; color: currentColor; cursor: pointer; min-width: ${v('space-gap-300')}; min-height: ${v('space-gap-300')}; border-radius: ${v('radius-pill')}; }

/* ===== Avatar ===== */
.t-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  background: ${v('color-surface-sunken')};
  color: ${v('color-text-secondary')};
  font-family: ${v('type-role-label-family')};
  font-weight: ${v('type-role-label-weight')};
  overflow: hidden; flex-shrink: 0; user-select: none;
}
.t-avatar[data-shape='circle'] { border-radius: ${v('radius-pill')}; }
.t-avatar[data-shape='square'] { border-radius: ${v('radius-control')}; }
.t-avatar[data-size='sm'] { width: ${v('space-gap-400')}; height: ${v('space-gap-400')}; font-size: ${v('emphasis-level5-size')}; }
.t-avatar[data-size='md'] { width: ${v('space-gap-600')}; height: ${v('space-gap-600')}; font-size: ${v('emphasis-level4-size')}; }
.t-avatar[data-size='lg'] { width: ${v('space-gap-800')}; height: ${v('space-gap-800')}; font-size: ${v('emphasis-level2-size')}; }
.t-avatar img { width: 100%; height: 100%; object-fit: cover; }

/* ===== Spinner (sem timers JS; reduced-motion via var de duração) ===== */
@keyframes t-spin { to { transform: rotate(360deg); } }
.t-spinner {
  display: inline-block; flex-shrink: 0;
  border: 2px solid ${v('color-border-default')};
  border-top-color: ${v('color-accent-default')};
  border-radius: ${v('radius-pill')};
  animation: t-spin ${v('motion-emphasis-duration')} linear infinite;
}
.t-spinner[data-size='sm'] { width: ${v('space-gap-200')}; height: ${v('space-gap-200')}; }
.t-spinner[data-size='md'] { width: ${v('space-gap-300')}; height: ${v('space-gap-300')}; }
.t-spinner[data-size='lg'] { width: ${v('space-gap-400')}; height: ${v('space-gap-400')}; }
@media (prefers-reduced-motion: reduce) { .t-spinner { animation-duration: 0s; } }

/* ===== Skeleton ===== */
@keyframes t-pulse { 50% { opacity: ${v('opacity-muted')}; } }
.t-skeleton { background: ${v('color-surface-sunken')}; animation: t-pulse ${v('motion-emphasis-duration')} ${v('motion-emphasis-easing')} infinite; }
.t-skeleton[data-variant='text'] { border-radius: ${v('radius-control')}; height: ${v('space-gap-200')}; width: 100%; }
.t-skeleton[data-variant='rect'] { border-radius: ${v('radius-card')}; }
.t-skeleton[data-variant='circle'] { border-radius: ${v('radius-pill')}; }
@media (prefers-reduced-motion: reduce) { .t-skeleton { animation: none; } }

/* ===== utilitário visually-hidden (a11y) ===== */
.t-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
`;

const STYLE_ELEMENT_ID = 'tauros-ui-styles';

/**
 * Injeta a folha uma única vez (idempotente). SSR: renderize
 * `<style id="tauros-ui-styles">{taurosUiStyles}</style>` no documento.
 */
export function injectUiStyles(doc: Document | undefined = globalThis.document): void {
  if (doc === undefined) return;
  if (doc.getElementById(STYLE_ELEMENT_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = taurosUiStyles;
  doc.head.appendChild(style);
}
