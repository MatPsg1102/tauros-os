// Início do dia operacional no fuso da LOJA — base ÚNICA do vencimento das
// tarefas (dueOffsetMinutes conta a partir daqui). Determinístico para
// (instante, fuso); sem bibliotecas externas.

import { operationalDateFor } from '../operator-session/open-operator-session.js';

function civilClockAsUtc(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
}

/**
 * Meia-noite civil da data operacional corrente, no fuso da loja, como
 * instante UTC. Duas iterações de correção cobrem transições de offset (DST).
 */
export function storeDayStartFor(instant: Date, timeZone: string): Date {
  const date = operationalDateFor(instant, timeZone);
  let guess = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 2; i++) {
    const offsetMs = civilClockAsUtc(guess, timeZone) - guess.getTime();
    guess = new Date(new Date(`${date}T00:00:00Z`).getTime() - offsetMs);
  }
  return guess;
}
