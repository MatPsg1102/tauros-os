import { describe, expect, it } from 'vitest';

import { resolveAliases } from './aliases.js';
import { contextTokens, dominantStatus, resolveContext, STATUS_PRECEDENCE } from './context.js';
import { core } from './core.js';
import { cssVar, toCssBlock, toCssVariables } from './css.js';
import { resolveTheme } from './runtime.js';
import { darkTheme, lightTheme } from './semantic.js';

describe('camadas (5.2-A): Core → Semantic → Context', () => {
  it('semantic referencia valores do core (mesma identidade)', () => {
    expect(lightTheme.color.accent.default).toBe(core.color.brand[500]);
    expect(lightTheme.color.surface.app).toBe(core.color.neutral[50]);
    expect(lightTheme.emphasis.level5.family).toBe(core.type.family.mono);
  });

  it('glove-first no DEFAULT: alvo mínimo é 64px sem modo algum (P4)', () => {
    expect(lightTheme.size.controlMin).toBe(core.touch.glove);
    expect(core.touch.glove).toBe('64px');
  });

  it('status é multidimensional por construção (P5: cor + forma + ícone)', () => {
    for (const status of Object.values(lightTheme.color.status)) {
      expect(status.fg).toMatch(/^#/);
      expect(status.bg).toMatch(/^#/);
      expect(['circle', 'triangle', 'square']).toContain(status.shape);
      expect(status.icon).toBeTruthy();
    }
    // warn e error diferem em FORMA, não só em cor
    expect(lightTheme.color.status.warn.shape).not.toBe(lightTheme.color.status.error.shape);
  });

  it('context cobre os 8 estados da fila e resolve para semantic', () => {
    expect(Object.keys(contextTokens.sync)).toHaveLength(8);
    const conflict = resolveContext(lightTheme, contextTokens.sync.conflict);
    expect(conflict).toBe(lightTheme.color.status.critical);
  });

  it('estados compostos: precedência de criticidade decide o dominante', () => {
    expect(STATUS_PRECEDENCE[0]).toBe('critical');
    const dominant = dominantStatus([
      contextTokens.sync.pending, // warn
      contextTokens.priority.urgent, // critical
      contextTokens.connection.offline, // warn
    ]);
    expect(dominant).toBe('critical');
    expect(dominantStatus([])).toBe('neutral');
  });
});

describe('temas e runtime (5.2-B §6)', () => {
  it('dark rebinda superfícies/texto/acento sem mudar a estrutura', () => {
    expect(darkTheme.color.surface.app).toBe(core.color.neutral[900]);
    expect(darkTheme.color.accent.default).toBe(core.color.brand[300]);
    expect(Object.keys(darkTheme.color.status)).toEqual(Object.keys(lightTheme.color.status));
  });

  it('modos são combináveis e determinísticos (industrial + glove + dark)', () => {
    const a = resolveTheme(['dark', 'industrial', 'glove']);
    const b = resolveTheme(['dark', 'industrial', 'glove']);
    expect(a).toEqual(b);
    expect(a.size.controlMin).toBe(core.touch.glovePlus); // glove
    expect(a.emphasis.level1.size).toBe(core.type.size[600]); // industrial
    expect(a.color.surface.app).toBe(core.color.neutral[900]); // dark
  });

  it('highContrast troca elevação por contorno e reforça texto secundário', () => {
    const hc = resolveTheme(['highContrast']);
    expect(hc.elevation.card).toContain('0 0 0 1px');
    expect(hc.color.text.secondary).toBe(hc.color.text.primary);
  });

  it('reducedMotion zera durações mas preserva a estrutura de motion', () => {
    const rm = resolveTheme(['reducedMotion']);
    expect(rm.motion.enter.duration).toBe('0ms');
    expect(rm.motion.emphasis.duration).toBe('0ms');
  });
});

describe('aliases (Ajuste 1)', () => {
  it('resolvem coerentes em qualquer tema', () => {
    const light = resolveAliases(lightTheme);
    const dark = resolveAliases(darkTheme);
    expect(light.actionable.bg).toBe(lightTheme.color.accent.default);
    expect(dark.actionable.bg).toBe(darkTheme.color.accent.default);
    expect(light.focusRing.color).toBe(lightTheme.color.border.focus);
    expect(light.disabled.opacity).toBe(core.opacity.disabled);
  });
});

describe('CSS variables (consumo pelos componentes)', () => {
  it('geração é determinística, ordenada e com prefixo --tauros', () => {
    const vars = toCssVariables(lightTheme);
    const keys = Object.keys(vars);
    expect(keys.length).toBeGreaterThan(80);
    expect(keys.every((k) => k.startsWith('--tauros-'))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
    expect(vars['--tauros-color-accent-default']).toBe(core.color.brand[500]);
    expect(vars['--tauros-size-control-min']).toBe('64px');
  });

  it('dark gera as MESMAS chaves do light (estrutura idêntica)', () => {
    expect(Object.keys(toCssVariables(darkTheme))).toEqual(Object.keys(toCssVariables(lightTheme)));
  });

  it('cssVar referencia a variável; toCssBlock injeta em seletor', () => {
    expect(cssVar('color-accent-default')).toBe('var(--tauros-color-accent-default)');
    const block = toCssBlock(darkTheme, '[data-theme="dark"]');
    expect(block).toContain('[data-theme="dark"] {');
    expect(block).toContain('--tauros-color-surface-app: ' + core.color.neutral[900]);
  });
});
