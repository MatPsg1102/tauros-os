// Estratégia ÚNICA de estilização (6.3.3 §1): folha CSS estática gerada por
// código, com TODO valor visual vindo de cssVar() (@tauros/tokens).
// - classes estáveis prefixadas `t-`; variantes via data-attributes;
// - zero custo por render (string constante); SSR = injetar a string;
// - reduced-motion/dark/contraste/glove resolvidos pelos PRÓPRIOS tokens
//   (rebinding do ThemeProvider) — sem condicionais React por tema.
// Valores estruturais inevitáveis (display, position, 100%, 1px de borda,
// transparent/currentColor) são os únicos literais — ver allowlist do scanner.

import { core, cssVar } from '@tauros/tokens';

const v = cssVar;
// breakpoints CONGELADOS embutidos na folha via token (media query não aceita
// var(); o valor vem de core.breakpoint — nunca literal neste fonte)
const bp = core.breakpoint;

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
.t-btn[data-loading='true'] .t-btn-content { opacity: 0; }
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

/* ===== Form Components (6.3.4) — mesma fundação, mesma folha ===== */

/* Field: composição rótulo/descrição/erro */
.t-field { display: flex; flex-direction: column; gap: ${v('space-gap-50')}; }
.t-field-desc {
  margin: 0; color: ${v('color-text-secondary')};
  font-family: ${v('type-role-caption-family')}; font-size: ${v('emphasis-level4-size')};
  line-height: ${v('type-role-caption-leading')};
}
.t-field-error {
  margin: 0; display: flex; align-items: center; gap: ${v('space-gap-50')};
  color: ${v('color-status-error-fg')};
  font-family: ${v('type-role-label-family')}; font-size: ${v('emphasis-level4-size')};
  font-weight: ${v('type-role-label-weight')};
}
.t-field-error-marker {
  width: ${v('space-gap-100')}; height: ${v('space-gap-100')};
  background: currentColor; flex-shrink: 0; border-radius: 0;
}
.t-field-required { color: ${v('color-status-error-fg')}; }

/* ControlFrame: moldura compartilhada de campos de texto/select */
.t-frame {
  display: flex; align-items: center; gap: ${v('space-gap-100')};
  min-height: ${v('size-control-min')};
  padding-inline: ${v('space-inset-md')};
  border: 1px solid ${v('color-border-strong')};
  border-radius: ${v('radius-control')};
  background: ${v('color-surface-raised')};
  transition: border-color ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-frame:focus-within { outline: 2px solid ${v('color-border-focus')}; outline-offset: 2px; }
.t-frame[data-invalid='true'] { border-color: ${v('color-status-error-fg')}; }
.t-frame[data-disabled='true'] { opacity: ${v('opacity-disabled')}; }
.t-frame[data-readonly='true'] { background: ${v('color-surface-sunken')}; }
.t-frame[data-size='sm'] { padding-inline: ${v('space-inset-sm')}; }
.t-frame[data-size='lg'] { padding-inline: ${v('space-inset-lg')}; }
.t-adorn { display: inline-flex; align-items: center; color: ${v('color-text-tertiary')}; flex-shrink: 0; }

/* controle nativo interno da moldura */
.t-control {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  color: ${v('color-text-primary')};
  font-family: ${v('type-role-body-family')};
  font-size: ${v('emphasis-level3-size')};
  line-height: ${v('type-role-body-leading')};
  padding: 0; min-height: ${v('space-gap-300')};
}
.t-control::placeholder { color: ${v('color-text-tertiary')}; opacity: ${v('opacity-full')}; }
.t-control:disabled { cursor: not-allowed; }
.t-control[data-numeric='true'] {
  font-family: ${v('type-role-data-family')}; font-variant-numeric: tabular-nums;
}
textarea.t-control { padding-block: ${v('space-gap-100')}; min-height: ${v('space-gap-800')}; }
textarea.t-control[data-resize='none'] { resize: none; }
textarea.t-control[data-resize='vertical'] { resize: vertical; }
select.t-control { appearance: none; cursor: pointer; align-self: stretch; }
select.t-control[multiple] { min-height: ${v('space-gap-1000')}; cursor: default; padding-block: ${v('space-gap-100')}; }
.t-frame-textarea { align-items: stretch; }
.t-select-arrow {
  width: ${v('space-gap-100')}; height: ${v('space-gap-100')};
  background: currentColor; color: ${v('color-text-secondary')};
  clip-path: polygon(0 0, 100% 0, 50% 100%); flex-shrink: 0;
}

/* limpar (SearchInput) — mesma linguagem do Chip remove */
.t-clear {
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: ${v('color-text-secondary')};
  cursor: pointer; flex-shrink: 0;
  min-width: ${v('space-gap-300')}; min-height: ${v('space-gap-300')};
  border-radius: ${v('radius-pill')};
}
.t-search-glyph { position: relative; width: ${v('space-gap-200')}; height: ${v('space-gap-200')}; flex-shrink: 0; }
.t-search-glyph::before {
  content: ''; position: absolute; inset: 0;
  width: ${v('space-gap-150')}; height: ${v('space-gap-150')};
  border: 2px solid currentColor; border-radius: ${v('radius-pill')};
}
.t-search-glyph::after {
  content: ''; position: absolute; right: 0; bottom: 0;
  width: 2px; height: ${v('space-gap-50')};
  background: currentColor; transform: rotate(-45deg);
}

/* Checkbox / Radio — glifo de forma além da cor (P5) */
.t-check, .t-radio-input {
  appearance: none; margin: 0; flex-shrink: 0; cursor: pointer; position: relative;
  width: ${v('space-gap-300')}; height: ${v('space-gap-300')};
  border: 2px solid ${v('color-border-strong')};
  background: ${v('color-surface-raised')};
}
.t-check { border-radius: ${v('radius-control')}; }
.t-radio-input { border-radius: ${v('radius-pill')}; }
.t-check:checked, .t-radio-input:checked { border-color: ${v('color-accent-default')}; background: ${v('color-accent-default')}; }
.t-check:checked::after {
  content: ''; position: absolute; inset: 0; margin: auto;
  width: ${v('space-gap-100')}; height: ${v('space-gap-150')};
  border-right: 2px solid ${v('color-text-on-accent')};
  border-bottom: 2px solid ${v('color-text-on-accent')};
  transform: rotate(45deg) translateY(-1px);
}
.t-check[data-indeterminate='true']::after {
  content: ''; position: absolute; inset: 0; margin: auto;
  width: ${v('space-gap-150')}; height: 2px; border: none;
  background: ${v('color-text-on-accent')}; transform: none;
}
.t-check[data-indeterminate='true'] { border-color: ${v('color-accent-default')}; background: ${v('color-accent-default')}; }
.t-radio-input:checked::after {
  content: ''; position: absolute; inset: 0; margin: auto;
  width: ${v('space-gap-100')}; height: ${v('space-gap-100')};
  border-radius: ${v('radius-pill')}; background: ${v('color-text-on-accent')};
}
.t-check:disabled, .t-radio-input:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-check[data-invalid='true'], .t-radio-input[data-invalid='true'] { border-color: ${v('color-status-error-fg')}; }
.t-check:focus-visible, .t-radio-input:focus-visible, .t-switch-input:focus-visible {
  outline: 2px solid ${v('color-border-focus')}; outline-offset: 2px;
}

/* linha rotulada glove-first (área de toque = linha inteira) */
.t-choice-row {
  display: flex; align-items: center; gap: ${v('space-gap-100')};
  min-height: ${v('size-control-min')}; cursor: pointer;
  font-family: ${v('type-role-body-family')}; color: ${v('color-text-primary')};
  font-size: ${v('emphasis-level3-size')};
}
.t-choice-row[data-disabled='true'] { cursor: not-allowed; color: ${v('color-text-tertiary')}; }

/* RadioGroup */
.t-radiogroup { border: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${v('space-gap-50')}; }
.t-radiogroup-items { display: flex; gap: ${v('space-gap-100')}; }
.t-radiogroup-items[data-orientation='vertical'] { flex-direction: column; }
.t-radiogroup-items[data-orientation='horizontal'] { flex-direction: row; flex-wrap: wrap; gap: ${v('space-gap-300')}; }
.t-radiogroup-legend {
  padding: 0; font-family: ${v('type-role-label-family')};
  font-weight: ${v('type-role-label-weight')}; color: ${v('color-text-primary')};
  font-size: ${v('emphasis-level3-size')};
}

/* Switch — estado por POSIÇÃO do polegar, não só cor (P5) */
.t-switch-input {
  appearance: none; margin: 0; flex-shrink: 0; cursor: pointer; position: relative;
  width: ${v('space-gap-600')}; height: ${v('space-gap-300')};
  border-radius: ${v('radius-pill')};
  background: ${v('color-border-strong')};
  border: 2px solid transparent;
  transition: background-color ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-switch-input::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 0; margin: auto 0;
  width: ${v('space-gap-200')}; height: ${v('space-gap-200')};
  border-radius: ${v('radius-pill')}; background: ${v('color-surface-raised')};
  box-shadow: ${v('elevation-card')};
  transition: transform ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-switch-input:checked { background: ${v('color-accent-default')}; }
.t-switch-input:checked::after { transform: translateX(${v('space-gap-300')}); }
.t-switch-input:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { .t-switch-input, .t-switch-input::after { transition: none; } }

/* PinInput */
.t-pin { display: flex; gap: ${v('space-gap-100')}; }
.t-pin-cell {
  width: ${v('size-control-min')}; min-height: ${v('size-control-min')};
  text-align: center;
  font-family: ${v('type-role-data-family')}; font-size: ${v('emphasis-level2-size')};
  color: ${v('color-text-primary')};
  border: 1px solid ${v('color-border-strong')};
  border-radius: ${v('radius-control')};
  background: ${v('color-surface-raised')};
}
.t-pin-cell:focus-visible { outline: 2px solid ${v('color-border-focus')}; outline-offset: 2px; }
.t-pin[data-invalid='true'] .t-pin-cell { border-color: ${v('color-status-error-fg')}; }
.t-pin-cell:disabled { opacity: ${v('opacity-disabled')}; }

/* MultiSelect: resumo com chips */
.t-ms-summary { display: flex; flex-wrap: wrap; gap: ${v('space-gap-50')}; }
.t-ms-empty { color: ${v('color-text-tertiary')}; font-family: ${v('type-role-caption-family')}; font-size: ${v('emphasis-level4-size')}; }

/* ===== Feedback (6.3.5) — overlays, mensagens, progresso, estados ===== */

/* Dialog/Modal: camada + backdrop translúcido por tokens (nunca cor literal) */
@keyframes t-overlay-in { from { opacity: 0; } to { opacity: ${v('opacity-full')}; } }
.t-dialog-layer {
  position: fixed; inset: 0; z-index: ${v('z-dialog')};
  display: flex; align-items: center; justify-content: center;
  padding: ${v('space-inset-lg')};
}
.t-dialog-layer-modal::before {
  content: ''; position: absolute; inset: 0;
  background: ${v('color-text-primary')};
  opacity: ${v('opacity-overlay')};
}
.t-dialog {
  position: relative;
  background: ${v('color-surface-raised')};
  color: ${v('color-text-primary')};
  border-radius: ${v('radius-card')};
  box-shadow: ${v('elevation-dialog')};
  padding: ${v('space-inset-lg')};
  max-width: 65ch;
  width: 100%;
  max-height: 85vh; overflow-y: auto;
  animation: t-overlay-in ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: ${v('space-gap-200')}; }
.t-dialog-desc { margin: 0; color: ${v('color-text-secondary')}; font-family: ${v('type-role-body-family')}; line-height: ${v('type-role-body-leading')}; }
.t-confirm-actions { margin-block-start: ${v('space-gap-300')}; }
@media (prefers-reduced-motion: reduce) { .t-dialog { animation: none; } }

/* Popover / Tooltip: posicionados pelo adapter (top/left via JS) */
.t-popover {
  position: absolute; top: 0; left: 0; z-index: ${v('z-dialog')};
  background: ${v('color-surface-raised')};
  color: ${v('color-text-primary')};
  border: 1px solid ${v('color-border-default')};
  border-radius: ${v('radius-card')};
  box-shadow: ${v('elevation-sheet')};
  padding: ${v('space-inset-md')};
  max-width: 40ch;
  animation: t-overlay-in ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-tooltip {
  position: absolute; top: 0; left: 0; z-index: ${v('z-dialog')};
  background: ${v('color-text-primary')};
  color: ${v('color-surface-raised')};
  border-radius: ${v('radius-control')};
  padding-block: ${v('space-gap-50')};
  padding-inline: ${v('space-gap-100')};
  font-family: ${v('type-role-caption-family')};
  font-size: ${v('emphasis-level4-size')};
  line-height: ${v('type-role-caption-leading')};
  box-shadow: ${v('elevation-card')};
  pointer-events: none;
  animation: t-overlay-in ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
@media (prefers-reduced-motion: reduce) { .t-popover, .t-tooltip { animation: none; } }

/* Alert (persistente no fluxo) e Banner (alta visibilidade) */
.t-alert {
  display: flex; align-items: flex-start; gap: ${v('space-gap-100')};
  border: 1px solid ${v('color-border-default')};
  border-inline-start: ${v('space-gap-50')} solid currentColor;
  border-radius: ${v('radius-card')};
  padding: ${v('space-inset-md')};
}
.t-alert[data-status='info'] { color: ${v('color-status-info-fg')}; background: ${v('color-status-info-bg')}; }
.t-alert[data-status='success'] { color: ${v('color-status-success-fg')}; background: ${v('color-status-success-bg')}; }
.t-alert[data-status='warn'] { color: ${v('color-status-warn-fg')}; background: ${v('color-status-warn-bg')}; }
.t-alert[data-status='error'] { color: ${v('color-status-error-fg')}; background: ${v('color-status-error-bg')}; }
.t-alert-marker, .t-banner-marker, .t-state-marker {
  width: ${v('space-gap-150')}; height: ${v('space-gap-150')};
  background: currentColor; flex-shrink: 0;
  margin-block-start: ${v('space-gap-50')};
}
.t-alert-marker[data-shape='circle'], .t-banner-marker[data-shape='circle'] { border-radius: ${v('radius-pill')}; }
.t-alert-marker[data-shape='triangle'], .t-banner-marker[data-shape='triangle'], .t-state-marker[data-shape='triangle'] { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.t-alert-body { flex: 1; min-width: 0; }
.t-alert-title { margin: 0; font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')}; }
.t-alert-desc { color: ${v('color-text-primary')}; font-family: ${v('type-role-body-family')}; line-height: ${v('type-role-body-leading')}; }
.t-alert-action { margin-block-start: ${v('space-gap-100')}; }

.t-banner {
  display: flex; align-items: center; gap: ${v('space-gap-200')};
  width: 100%;
  min-height: ${v('size-control-min')};
  padding-block: ${v('space-gap-100')};
  padding-inline: ${v('space-inset-lg')};
  font-family: ${v('type-role-label-family')};
  font-weight: ${v('type-role-label-weight')};
  font-size: ${v('emphasis-level3-size')};
}
.t-banner[data-status='info'] { color: ${v('color-status-info-fg')}; background: ${v('color-status-info-bg')}; }
.t-banner[data-status='success'] { color: ${v('color-status-success-fg')}; background: ${v('color-status-success-bg')}; }
.t-banner[data-status='warn'] { color: ${v('color-status-warn-fg')}; background: ${v('color-status-warn-bg')}; }
.t-banner[data-status='error'] { color: ${v('color-status-error-fg')}; background: ${v('color-status-error-bg')}; }
.t-banner[data-status='critical'] { color: ${v('color-status-critical-fg')}; background: ${v('color-status-critical-bg')}; }
.t-banner[data-status='neutral'] { color: ${v('color-status-neutral-fg')}; background: ${v('color-status-neutral-bg')}; }
.t-banner-content { flex: 1; min-width: 0; color: ${v('color-text-primary')}; }

/* Toast: região fixa (z-toast — nunca oculto por outros overlays) */
.t-toast-region {
  position: fixed; z-index: ${v('z-toast')};
  inset-block-end: ${v('space-gap-300')}; inset-inline-end: ${v('space-gap-300')};
  display: flex; flex-direction: column; gap: ${v('space-gap-100')};
  max-width: 40ch; width: 100%;
  pointer-events: none;
}
.t-toast-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${v('space-gap-100')}; }
.t-toast {
  display: flex; align-items: flex-start; gap: ${v('space-gap-100')};
  pointer-events: auto;
  background: ${v('color-surface-raised')};
  color: ${v('color-text-primary')};
  border: 1px solid ${v('color-border-default')};
  border-radius: ${v('radius-card')};
  box-shadow: ${v('elevation-sheet')};
  padding: ${v('space-inset-md')};
  animation: t-overlay-in ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-toast[data-priority='urgent'] { border-inline-start: ${v('space-gap-50')} solid ${v('color-status-critical-fg')}; }
.t-toast-body { flex: 1; min-width: 0; }
.t-toast-title { margin: 0; font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')}; }
.t-toast-desc { margin: 0; color: ${v('color-text-secondary')}; font-family: ${v('type-role-body-family')}; font-size: ${v('emphasis-level4-size')}; }
.t-toast-action {
  border: none; background: transparent; cursor: pointer;
  color: ${v('color-accent-default')};
  font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')};
  min-height: ${v('space-gap-300')}; border-radius: ${v('radius-control')};
}
@media (prefers-reduced-motion: reduce) { .t-toast { animation: none; } }

/* Progress linear */
.t-progress-row { display: flex; align-items: center; gap: ${v('space-gap-100')}; }
.t-progress {
  flex: 1; height: ${v('space-gap-100')};
  background: ${v('color-surface-sunken')};
  border: 1px solid ${v('color-border-default')};
  border-radius: ${v('radius-pill')};
  overflow: hidden;
}
.t-progress-fill {
  height: 100%; background: ${v('color-accent-default')};
  border-radius: ${v('radius-pill')};
  transition: width ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
@keyframes t-progress-slide { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
.t-progress[data-indeterminate='true'] .t-progress-fill {
  width: 25%;
  animation: t-progress-slide ${v('motion-emphasis-duration')} ${v('motion-emphasis-easing')} infinite;
}
.t-progress-valuetext { font-family: ${v('type-role-data-family')}; font-size: ${v('emphasis-level4-size')}; color: ${v('color-text-secondary')}; }
@media (prefers-reduced-motion: reduce) {
  .t-progress-fill { transition: none; }
  .t-progress[data-indeterminate='true'] .t-progress-fill { animation: none; width: 100%; opacity: ${v('opacity-muted')}; }
}

/* Estados de região */
.t-state {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: ${v('space-gap-100')};
  padding: ${v('space-inset-lg')};
}
.t-state-icon { color: ${v('color-text-tertiary')}; }
.t-state-actions { display: flex; gap: ${v('space-gap-100')}; flex-wrap: wrap; justify-content: center; margin-block-start: ${v('space-gap-100')}; }
.t-error-state .t-state-marker { color: ${v('color-status-error-fg')}; }
.t-loading-skeletons { display: flex; flex-direction: column; gap: ${v('space-gap-100')}; width: 100%; }

/* ===== Navigation (6.3.6) ===== */

/* posições da camada de Dialog (base de Drawer/BottomSheet) */
.t-dialog-layer[data-position='left'] { justify-content: flex-start; align-items: stretch; padding: 0; }
.t-dialog-layer[data-position='right'] { justify-content: flex-end; align-items: stretch; padding: 0; }
.t-dialog-layer[data-position='bottom'] { align-items: flex-end; justify-content: stretch; padding: 0; }
.t-drawer {
  max-width: 40ch; width: 100%; height: 100%; max-height: none;
  border-radius: 0; animation-name: t-overlay-in;
}
.t-bottomsheet {
  max-width: none; width: 100%; max-height: 85vh; overflow-y: auto;
  border-radius: ${v('radius-card')} ${v('radius-card')} 0 0;
  padding-block-end: calc(${v('space-inset-lg')} + env(safe-area-inset-bottom));
}

/* NavigationItem */
.t-navitem-li { list-style: none; }
.t-navitem {
  display: flex; align-items: center; gap: ${v('space-gap-100')};
  width: 100%; min-height: ${v('size-control-min')};
  padding-inline: ${v('space-inset-md')};
  border: none; background: transparent; cursor: pointer;
  color: ${v('color-text-primary')}; text-decoration: none;
  font-family: ${v('type-role-label-family')};
  font-weight: ${v('type-role-label-weight')};
  font-size: ${v('emphasis-level3-size')};
  border-radius: ${v('radius-control')};
  position: relative; text-align: start;
}
.t-navitem:hover:not([aria-disabled='true']):not(:disabled) { background: ${v('color-surface-sunken')}; }
/* current: barra indicadora por POSIÇÃO + cor (P5) */
.t-navitem[data-current='true'] { color: ${v('color-accent-default')}; background: ${v('color-status-info-bg')}; }
.t-navitem[data-current='true']::before {
  content: ''; position: absolute; inset-block: ${v('space-gap-50')}; inset-inline-start: 0;
  width: ${v('space-gap-50')}; border-radius: ${v('radius-pill')};
  background: ${v('color-accent-default')};
}
.t-navitem[data-active='true'] { background: ${v('color-surface-sunken')}; }
.t-navitem[data-unavailable='true'], .t-navitem:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-navitem-icon { display: inline-flex; flex-shrink: 0; }
.t-navitem-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.t-navitem-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-navitem-desc { color: ${v('color-text-tertiary')}; font-size: ${v('emphasis-level5-size')}; font-weight: ${v('type-role-caption-weight')}; }
.t-navitem-badge { flex-shrink: 0; }

/* NavigationGroup */
.t-navgroup { list-style: none; }
.t-navgroup-header {
  display: flex; align-items: center; justify-content: space-between; width: 100%;
  min-height: ${v('size-control-min')};
  padding-inline: ${v('space-inset-md')};
  border: none; background: transparent; cursor: pointer;
  color: ${v('color-text-secondary')};
  font-family: ${v('type-role-caption-family')};
  font-size: ${v('emphasis-level4-size')};
  font-weight: ${v('type-role-label-weight')};
  text-transform: uppercase; letter-spacing: ${v('space-gap-25')};
  border-radius: ${v('radius-control')};
}
span.t-navgroup-header { cursor: default; }
.t-navgroup-chevron {
  width: ${v('space-gap-100')}; height: ${v('space-gap-100')};
  background: currentColor; clip-path: polygon(0 0, 100% 0, 50% 100%);
  transition: transform ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-navgroup-chevron[data-expanded='false'] { transform: rotate(-90deg); }
.t-navgroup-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${v('space-gap-25')}; }
@media (prefers-reduced-motion: reduce) { .t-navgroup-chevron { transition: none; } }

/* Sidebar */
.t-sidebar {
  display: flex; flex-direction: column; gap: ${v('space-gap-100')};
  width: 100%; max-width: 30ch; min-height: 0;
  background: ${v('color-surface-raised')};
  border-inline-end: 1px solid ${v('color-border-default')};
  padding: ${v('space-inset-sm')};
}
.t-sidebar[data-collapsed='true'] { max-width: calc(${v('size-control-min')} + ${v('space-inset-sm')} + ${v('space-inset-sm')}); }
.t-sidebar[data-collapsed='true'] .t-navitem { justify-content: center; padding-inline: 0; }
.t-sidebar-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${v('space-gap-25')}; flex: 1; }
.t-sidebar-header, .t-sidebar-footer { display: flex; align-items: center; gap: ${v('space-gap-100')}; }
.t-sidebar-toggle-glyph { width: ${v('space-gap-150')}; height: 2px; background: currentColor; box-shadow: 0 ${v('space-gap-50')} 0 currentColor, 0 calc(${v('space-gap-50')} * -1) 0 currentColor; }

/* TopBar */
.t-topbar {
  display: flex; align-items: center; gap: ${v('space-gap-200')};
  width: 100%; min-height: calc(${v('size-control-min')} + ${v('space-gap-100')});
  padding-inline: ${v('space-inset-lg')};
  background: ${v('color-surface-raised')};
  border-block-end: 1px solid ${v('color-border-default')};
}
.t-topbar[data-sticky='true'] { position: sticky; top: 0; z-index: ${v('z-sticky')}; }
.t-topbar-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-topbar-spacer { flex: 1; }
.t-topbar-leading, .t-topbar-nav, .t-topbar-actions, .t-topbar-trailing { display: flex; align-items: center; gap: ${v('space-gap-100')}; }

/* NavigationBar (bottom móvel) */
.t-navbar { width: 100%; background: ${v('color-surface-raised')}; border-block-start: 1px solid ${v('color-border-default')}; }
.t-navbar[data-fixed='true'] {
  position: fixed; inset-inline: 0; inset-block-end: 0; z-index: ${v('z-sticky')};
  padding-block-end: env(safe-area-inset-bottom);
}
.t-navbar-list { list-style: none; margin: 0; padding: 0; display: flex; }
.t-navbar-list .t-navitem-li { flex: 1; }
.t-navbar-list .t-navitem { flex-direction: column; gap: ${v('space-gap-25')}; justify-content: center; font-size: ${v('emphasis-level5-size')}; border-radius: 0; }
.t-navbar-list .t-navitem[data-current='true']::before { inset-inline: ${v('space-gap-200')}; inset-block-start: 0; inset-block-end: auto; width: auto; height: ${v('space-gap-50')}; }

/* FAB */
.t-fab {
  position: fixed; inset-block-end: ${v('space-gap-300')}; inset-inline-end: ${v('space-gap-300')};
  z-index: ${v('z-sticky')};
  border-radius: ${v('radius-pill')};
  box-shadow: ${v('elevation-sheet')};
  min-width: ${v('size-control-min')};
}

/* SegmentedControl */
.t-segmented {
  display: inline-flex; border: 1px solid ${v('color-border-strong')};
  border-radius: ${v('radius-control')}; padding: ${v('space-gap-25')};
  margin: 0; background: ${v('color-surface-sunken')}; gap: ${v('space-gap-25')};
}
.t-segment {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: calc(${v('size-control-min')} - ${v('space-gap-100')});
  padding-inline: ${v('space-inset-md')};
  border-radius: ${v('radius-control')}; cursor: pointer;
  font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')};
  font-size: ${v('emphasis-level4-size')}; color: ${v('color-text-secondary')};
}
.t-segment[data-selected='true'] { background: ${v('color-surface-raised')}; color: ${v('color-text-primary')}; box-shadow: ${v('elevation-card')}; }
.t-segment[data-disabled='true'] { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-segment:has(.t-segment-input:focus-visible) { outline: 2px solid ${v('color-border-focus')}; outline-offset: 2px; }

/* Breadcrumb */
.t-breadcrumb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: ${v('space-gap-50')}; }
.t-breadcrumb-item { display: inline-flex; align-items: center; gap: ${v('space-gap-50')}; max-width: 30ch; }
.t-breadcrumb-item + .t-breadcrumb-item::before { content: '/'; color: ${v('color-text-tertiary')}; }
.t-breadcrumb-link, .t-breadcrumb-current {
  font-family: ${v('type-role-body-family')}; font-size: ${v('emphasis-level4-size')};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border-radius: ${v('radius-control')};
}
.t-breadcrumb-link { color: ${v('color-text-secondary')}; text-decoration: none; }
.t-breadcrumb-link:hover { color: ${v('color-accent-default')}; text-decoration: underline; }
.t-breadcrumb-current { color: ${v('color-text-primary')}; font-weight: ${v('type-role-label-weight')}; }

/* Tabs */
.t-tablist { display: flex; gap: ${v('space-gap-50')}; border-block-end: 1px solid ${v('color-border-default')}; }
.t-tabs[data-orientation='vertical'] .t-tablist { flex-direction: column; border-block-end: none; border-inline-end: 1px solid ${v('color-border-default')}; }
.t-tab {
  border: none; background: transparent; cursor: pointer;
  min-height: ${v('size-control-min')}; padding-inline: ${v('space-inset-md')};
  color: ${v('color-text-secondary')};
  font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')};
  font-size: ${v('emphasis-level3-size')};
  border-block-end: ${v('space-gap-25')} solid transparent;
}
.t-tab[aria-selected='true'] { color: ${v('color-accent-default')}; border-block-end-color: ${v('color-accent-default')}; }
.t-tab:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-tabpanel { padding: ${v('space-inset-md')}; }

/* Stepper */
.t-stepper { list-style: none; margin: 0; padding: 0; display: flex; gap: ${v('space-gap-100')}; }
.t-stepper[data-orientation='vertical'] { flex-direction: column; }
.t-step { display: flex; align-items: center; gap: ${v('space-gap-100')}; flex: 1; min-width: 0; }
.t-step-content {
  display: flex; align-items: center; gap: ${v('space-gap-100')};
  border: none; background: transparent; cursor: default; text-align: start;
  min-height: ${v('size-control-min')}; padding-inline: ${v('space-gap-50')};
  border-radius: ${v('radius-control')}; color: ${v('color-text-secondary')};
}
button.t-step-content { cursor: pointer; }
.t-step-marker {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: ${v('space-gap-400')}; height: ${v('space-gap-400')};
  border-radius: ${v('radius-pill')};
  border: 2px solid ${v('color-border-strong')};
  font-family: ${v('type-role-data-family')}; font-size: ${v('emphasis-level4-size')};
  position: relative;
}
.t-step[data-status='current'] .t-step-content { color: ${v('color-text-primary')}; }
.t-step[data-status='current'] .t-step-marker { border-color: ${v('color-accent-default')}; color: ${v('color-accent-default')}; }
.t-step[data-status='completed'] .t-step-marker { border-color: ${v('color-status-success-fg')}; background: ${v('color-status-success-fg')}; }
.t-step[data-status='completed'] .t-step-marker::after {
  content: ''; width: ${v('space-gap-100')}; height: ${v('space-gap-150')};
  border-right: 2px solid ${v('color-text-on-accent')}; border-bottom: 2px solid ${v('color-text-on-accent')};
  transform: rotate(45deg) translateY(-1px);
}
.t-step[data-status='error'] .t-step-marker { border-color: ${v('color-status-error-fg')}; background: ${v('color-status-error-bg')}; clip-path: polygon(50% 0, 100% 100%, 0 100%); border-radius: 0; }
.t-step[data-status='disabled'] .t-step-content { opacity: ${v('opacity-disabled')}; }
.t-step-text { display: flex; flex-direction: column; min-width: 0; }
.t-step-label { font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')}; font-size: ${v('emphasis-level4-size')}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-step-desc { font-size: ${v('emphasis-level5-size')}; color: ${v('color-text-tertiary')}; }
.t-step-connector { flex: 1; height: 1px; background: ${v('color-border-default')}; min-width: ${v('space-gap-100')}; }
.t-stepper[data-orientation='vertical'] .t-step-connector { display: none; }

/* Pagination */
.t-pagination-list { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; gap: ${v('space-gap-50')}; flex-wrap: wrap; }
.t-page-item {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: ${v('size-control-min')}; min-height: ${v('size-control-min')};
  border: 1px solid transparent; background: transparent; cursor: pointer;
  border-radius: ${v('radius-control')}; text-decoration: none;
  color: ${v('color-text-primary')};
  font-family: ${v('type-role-data-family')}; font-size: ${v('emphasis-level4-size')};
}
.t-page-item:hover:not(:disabled) { background: ${v('color-surface-sunken')}; }
.t-page-item[data-current='true'] { background: ${v('color-accent-default')}; color: ${v('color-text-on-accent')}; }
.t-page-item:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-page-ellipsis { color: ${v('color-text-tertiary')}; padding-inline: ${v('space-gap-50')}; }

/* Menu / ContextMenu */
.t-menu {
  position: absolute; top: 0; left: 0; z-index: ${v('z-dialog')};
  min-width: 24ch; max-width: 40ch;
  background: ${v('color-surface-raised')};
  border: 1px solid ${v('color-border-default')};
  border-radius: ${v('radius-card')};
  box-shadow: ${v('elevation-sheet')};
  padding: ${v('space-gap-50')};
  display: flex; flex-direction: column; gap: ${v('space-gap-25')};
  animation: t-overlay-in ${v('motion-enter-duration')} ${v('motion-enter-easing')};
}
.t-menuitem {
  display: flex; align-items: center; gap: ${v('space-gap-100')};
  width: 100%; min-height: ${v('size-control-min')};
  padding-inline: ${v('space-inset-md')};
  border: none; background: transparent; cursor: pointer; text-align: start;
  color: ${v('color-text-primary')};
  font-family: ${v('type-role-body-family')}; font-size: ${v('emphasis-level3-size')};
  border-radius: ${v('radius-control')};
}
.t-menuitem:hover:not(:disabled), .t-menuitem:focus-visible { background: ${v('color-surface-sunken')}; outline: none; }
.t-menuitem:focus-visible { outline: 2px solid ${v('color-border-focus')}; outline-offset: 0; }
.t-menuitem:disabled { opacity: ${v('opacity-disabled')}; cursor: not-allowed; }
.t-menuitem-check, .t-menuitem-radio {
  width: ${v('space-gap-150')}; height: ${v('space-gap-150')}; flex-shrink: 0;
  border: 2px solid ${v('color-border-strong')};
}
.t-menuitem-check { border-radius: ${v('radius-control')}; }
.t-menuitem-radio { border-radius: ${v('radius-pill')}; }
.t-menuitem-check[data-checked='true'], .t-menuitem-radio[data-checked='true'] { background: ${v('color-accent-default')}; border-color: ${v('color-accent-default')}; }
.t-menu-separator { height: 1px; background: ${v('color-border-default')}; margin-block: ${v('space-gap-50')}; }
.t-menu-label {
  padding-inline: ${v('space-inset-md')}; padding-block: ${v('space-gap-50')};
  color: ${v('color-text-tertiary')};
  font-family: ${v('type-role-caption-family')}; font-size: ${v('emphasis-level5-size')};
  text-transform: uppercase;
}
@media (prefers-reduced-motion: reduce) { .t-menu { animation: none; } }

/* ===== Layouts (6.3.7) ===== */

/* SkipLink: oculto até focar (necessário no AppShell com navegação antes do main) */
.t-skiplink {
  position: absolute; inset-block-start: 0; inset-inline-start: 0;
  z-index: ${v('z-toast')};
  transform: translateY(-200%);
  background: ${v('color-accent-default')}; color: ${v('color-text-on-accent')};
  padding-block: ${v('space-gap-100')}; padding-inline: ${v('space-inset-md')};
  border-radius: 0 0 ${v('radius-control')} 0;
  font-family: ${v('type-role-label-family')}; font-weight: ${v('type-role-label-weight')};
  text-decoration: none;
}
.t-skiplink:focus-visible { transform: none; }

/* AppShell: UMA região de scroll (.t-shell-content); viewport dinâmica móvel */
.t-shell {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  overflow: hidden;
  background: ${v('color-surface-app')};
}
.t-shell-topbar { flex-shrink: 0; padding-block-start: env(safe-area-inset-top); }
.t-shell-middle { display: flex; flex: 1; min-height: 0; }
.t-shell-sidebar { flex-shrink: 0; display: flex; min-height: 0; overflow-y: auto; }
.t-shell-content { flex: 1; min-width: 0; min-height: 0; overflow-y: auto; }
.t-shell-navbar {
  flex-shrink: 0;
  padding-block-end: env(safe-area-inset-bottom);
  background: ${v('color-surface-raised')};
}
@media (max-width: ${bp.tablet}) {
  .t-shell-sidebar { display: none; }
}
@media (min-width: ${bp.tablet}) {
  .t-shell-navbar { display: none; }
}

/* Page: landmark + fluxo vertical por densidade */
.t-page {
  display: flex; flex-direction: column;
  padding: ${v('space-inset-lg')};
  padding-inline: max(${v('space-inset-lg')}, env(safe-area-inset-left));
  padding-inline-end: max(${v('space-inset-lg')}, env(safe-area-inset-right));
}
.t-page[data-density='compact'] { gap: ${v('space-gap-200')}; }
.t-page[data-density='default'] { gap: ${v('space-gap-300')}; }
.t-page[data-density='comfortable'] { gap: ${v('space-gap-400')}; }

/* Container: largura máxima + centralização (fontes congeladas) */
.t-container { width: 100%; margin-inline: auto; min-width: 0; }
.t-container[data-size='narrow'] { max-width: 65ch; }
.t-container[data-size='standard'] { max-width: ${bp.tablet}; }
.t-container[data-size='wide'] { max-width: ${bp.desktop}; }
.t-container[data-size='full'] { max-width: none; }

/* PageHeader: contexto da página (≠ TopBar) */
.t-pageheader { display: flex; flex-direction: column; gap: ${v('space-gap-100')}; }
.t-pageheader-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: ${v('space-gap-200')}; flex-wrap: wrap;
}
.t-pageheader-main { display: flex; flex-direction: column; gap: ${v('space-gap-50')}; min-width: 0; }
.t-pageheader-eyebrow {
  color: ${v('color-text-tertiary')};
  font-family: ${v('type-role-caption-family')}; font-size: ${v('emphasis-level5-size')};
  font-weight: ${v('type-role-label-weight')}; text-transform: uppercase;
}
.t-pageheader-titlerow { display: flex; align-items: center; gap: ${v('space-gap-100')}; flex-wrap: wrap; min-width: 0; }
.t-pageheader-title { overflow-wrap: anywhere; }
.t-pageheader-desc { margin: 0; color: ${v('color-text-secondary')}; font-family: ${v('type-role-body-family')}; line-height: ${v('type-role-body-leading')}; max-width: 65ch; }
.t-pageheader-actions { display: flex; gap: ${v('space-gap-100')}; flex-wrap: wrap; align-items: center; }
@media (max-width: ${bp.tablet}) {
  .t-pageheader-row { flex-direction: column; align-items: stretch; }
}

/* Section: região temática (≠ Panel) */
.t-section { display: flex; flex-direction: column; gap: ${v('space-gap-200')}; min-width: 0; }
.t-section-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: ${v('space-gap-200')}; flex-wrap: wrap;
}
.t-section-heading { display: flex; flex-direction: column; gap: ${v('space-gap-25')}; min-width: 0; }
.t-section-desc { margin: 0; color: ${v('color-text-secondary')}; font-family: ${v('type-role-caption-family')}; font-size: ${v('emphasis-level4-size')}; }
.t-section-actions { display: flex; gap: ${v('space-gap-100')}; flex-wrap: wrap; }

/* Panel: coluna com corpo rolável independente (contrato operacional) */
.t-panel { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.t-panel[data-fill='true'] { height: 100%; }
.t-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: ${v('space-gap-100')}; flex-shrink: 0; flex-wrap: wrap;
  padding: ${v('space-inset-md')};
  border-block-end: 1px solid ${v('color-border-default')};
}
.t-panel-actions { display: flex; gap: ${v('space-gap-50')}; align-items: center; }
.t-panel-body { flex: 1; min-height: 0; overflow-y: auto; padding: ${v('space-inset-md')}; }
.t-panel-footer {
  flex-shrink: 0; display: flex; justify-content: flex-end; gap: ${v('space-gap-100')};
  padding: ${v('space-inset-md')};
  border-block-start: 1px solid ${v('color-border-default')};
}

/* ResponsiveGrid: auto-fit por medida mínima (CSS puro, SSR determinístico) */
.t-rgrid { display: grid; min-width: 0; }
.t-rgrid > * { min-width: 0; }
.t-rgrid[data-item-size='sm'] { grid-template-columns: repeat(auto-fit, minmax(min(100%, 20ch), 1fr)); }
.t-rgrid[data-item-size='md'] { grid-template-columns: repeat(auto-fit, minmax(min(100%, 30ch), 1fr)); }
.t-rgrid[data-item-size='lg'] { grid-template-columns: repeat(auto-fit, minmax(min(100%, 40ch), 1fr)); }

/* SplitView: split estático responsivo (colapsa em pilha no mobile) */
.t-split { display: grid; gap: ${v('space-gap-300')}; min-width: 0; }
.t-split-primary, .t-split-secondary { min-width: 0; min-height: 0; }
.t-split[data-orientation='horizontal'][data-ratio='1:1'] { grid-template-columns: 1fr 1fr; }
.t-split[data-orientation='horizontal'][data-ratio='2:1'] { grid-template-columns: 2fr 1fr; }
.t-split[data-orientation='horizontal'][data-ratio='1:2'] { grid-template-columns: 1fr 2fr; }
.t-split[data-orientation='vertical'] { grid-template-columns: 1fr; }
.t-split[data-orientation='vertical'][data-ratio='1:1'] { grid-template-rows: 1fr 1fr; }
.t-split[data-orientation='vertical'][data-ratio='2:1'] { grid-template-rows: 2fr 1fr; }
.t-split[data-orientation='vertical'][data-ratio='1:2'] { grid-template-rows: 1fr 2fr; }
@media (max-width: ${bp.tablet}) {
  .t-split[data-orientation='horizontal'] { grid-template-columns: 1fr; }
}

/* StickyRegion: sticky tokenizado (container de scroll = ancestral com overflow) */
.t-stickyregion {
  position: sticky; z-index: ${v('z-sticky')};
  background: ${v('color-surface-app')};
}
.t-stickyregion[data-position='top'] {
  inset-block-start: 0;
  border-block-end: 1px solid ${v('color-border-default')};
}
.t-stickyregion[data-position='bottom'] {
  inset-block-end: 0;
  border-block-start: 1px solid ${v('color-border-default')};
  padding-block-end: env(safe-area-inset-bottom);
}

/* ===== utilitário visually-hidden (a11y) ===== */
.t-visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
`;

const STYLE_ELEMENT_ID = 'tauros-ui-styles';
const OWNERSHIP_ATTRIBUTE = 'data-tauros-ui-styles';

/** Elemento com o id reservado não foi criado por esta biblioteca (P7). */
export class IncompatibleStylesElementError extends Error {
  constructor() {
    super(
      `Já existe um elemento '#${STYLE_ELEMENT_ID}' que não foi criado por injectUiStyles ` +
        `(sem o atributo ${OWNERSHIP_ATTRIBUTE}). Remova-o ou use outro id — ` +
        `a folha oficial não sobrescreve conteúdo de origem desconhecida.`,
    );
    this.name = 'IncompatibleStylesElementError';
  }
}

/**
 * Injeção EXPLÍCITA e idempotente da folha oficial (nenhum import injeta CSS).
 * SSR: renderize `<style id="tauros-ui-styles" data-tauros-ui-styles="">{taurosUiStyles}</style>`.
 * Conteúdo de versão anterior (com marcador de propriedade) é atualizado;
 * elemento alheio com o mesmo id gera erro orientado.
 */
export function injectUiStyles(doc: Document | undefined = globalThis.document): void {
  if (doc === undefined) return;
  const existing = doc.getElementById(STYLE_ELEMENT_ID);
  if (existing !== null) {
    if (!existing.hasAttribute(OWNERSHIP_ATTRIBUTE)) throw new IncompatibleStylesElementError();
    if (existing.textContent !== taurosUiStyles) existing.textContent = taurosUiStyles;
    return;
  }
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.setAttribute(OWNERSHIP_ATTRIBUTE, '');
  style.textContent = taurosUiStyles;
  doc.head.appendChild(style);
}
