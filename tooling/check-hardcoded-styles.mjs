#!/usr/bin/env node
// Verificação automatizada de valores visuais hardcoded (6.3.3 §"verificação").
// Varre packages/ui-primitives/src e FALHA se encontrar:
//   - cores literais (#hex, rgb()/rgba(), hsl()/hsla())
//   - dimensões literais em px/rem/em (fora da allowlist estrutural)
//   - durações literais (ms/s) e z-index numérico
// Allowlist estrutural documentada (única exceção permitida):
//   - '1px'  → espessura de borda/divider (não existe token de border-width)
//   - '2px'  → espessura/offset do focus ring (alias congelado focusRing 2px/2px)
//   - '-1px' → técnica visually-hidden (a11y)
//   - '0s'   → parada de animação sob prefers-reduced-motion
//   - 0 / 100% / 50% / transparent / currentColor → estruturais, não estéticos

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
const TARGET = join(ROOT, 'packages', 'ui-primitives', 'src');

//   - '0px'  → zero estrutural (fallback de getComputedStyle no scroll lock)
const ALLOWED = new Set(['1px', '2px', '-1px', '0s', '0px']);

const RULES = [
  { name: 'cor hex literal', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'cor rgb/hsl literal', re: /\b(?:rgba?|hsla?)\(/g },
  { name: 'dimensão literal', re: /-?\d*\.?\d+(?:px|rem|em)\b/g },
  { name: 'duração literal', re: /\b\d*\.?\d+m?s\b/g },
  { name: 'z-index literal', re: /z-index:\s*\d+/g },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) yield full;
  }
}

const violations = [];
for (const file of walk(TARGET)) {
  // Comentários não são estilo: remove blocos /* */ e caudas // antes de varrer.
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, ''))
    .join('\n');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('scanner-allow')) return; // exceção explícita e visível no diff
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.re)) {
        const value = match[0];
        if (ALLOWED.has(value)) continue;
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          rule: rule.name,
          value,
          context: line.trim().slice(0, 100),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`FALHA: ${violations.length} valor(es) visual(is) hardcoded fora da allowlist:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] "${v.value}"\n    ${v.context}`);
  }
  process.exit(1);
}
console.log('OK: nenhum valor visual hardcoded fora da allowlist em @tauros/ui-primitives.');
