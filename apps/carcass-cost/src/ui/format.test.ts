// Testes de formatação — arredondamento SÓ na apresentação, pt-BR, 2 casas.
import { describe, expect, it } from 'vitest';

import {
  formatBRL,
  formatKg,
  formatPct,
  formatPerKg,
  formatSignedBRL,
  fromMinorUnits,
  toMinorUnits,
} from './format.js';

// Intl pt-BR usa espaço não separável entre "R$" e o número.
const NBSP = String.fromCharCode(0xa0);

describe('formatBRL / formatPerKg', () => {
  it('arredonda para 2 casas só na apresentação', () => {
    expect(formatBRL(7.1875)).toBe(`R$${NBSP}7,19`);
    expect(formatBRL(6.6875)).toBe(`R$${NBSP}6,69`);
    expect(formatPerKg(65_212 / 10_217.2)).toBe(`R$${NBSP}6,38/kg`);
  });

  it('agrupa milhares no padrão pt-BR', () => {
    expect(formatBRL(65_212)).toBe(`R$${NBSP}65.212,00`);
  });
});

describe('formatSignedBRL', () => {
  it('sinal explícito: "+" para acréscimo, "−" (menos tipográfico) para perda', () => {
    expect(formatSignedBRL(3_799.9973)).toBe(`+ R$${NBSP}3.800,00`);
    expect(formatSignedBRL(-200)).toBe(`− R$${NBSP}200,00`);
    expect(formatSignedBRL(0)).toBe(`+ R$${NBSP}0,00`);
  });
});

describe('formatKg', () => {
  it('kg com 2 casas e milhar pt-BR', () => {
    expect(formatKg(9_180.96)).toBe('9.180,96 kg');
    expect(formatKg(12_340)).toBe('12.340,00 kg');
  });
});

describe('formatPct', () => {
  it('converte fração em percentual com 2 casas', () => {
    expect(formatPct(0.744)).toBe('74,40%');
    expect(formatPct(2_122.8 / 12_340)).toBe('17,20%');
    expect(formatPct(10_217.2 / 12_340)).toBe('82,80%');
  });
});

describe('toMinorUnits / fromMinorUnits', () => {
  it('converte reais ↔ centavos preservando null (campo vazio)', () => {
    expect(toMinorUnits(4.8)).toBe(480);
    expect(fromMinorUnits(480)).toBe(4.8);
    expect(toMinorUnits(null)).toBeNull();
    expect(fromMinorUnits(null)).toBeNull();
  });
});
