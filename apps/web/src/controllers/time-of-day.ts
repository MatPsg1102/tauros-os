// Horário local da LOJA a partir de instante ISO — helper de APRESENTAÇÃO
// compartilhado pelos view models (Frontend Experience V2: fonte única — três
// controllers duplicavam esta função). Formatters cacheados por fuso: criar
// Intl.DateTimeFormat é caro e o quadro re-renderiza com o relógio.

const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function timeFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = TIME_FORMATTERS.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    });
    TIME_FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

/** "HH:mm" no fuso informado; null para entrada ausente/inválida. */
export function timeOfDay(iso: string | null | undefined, timeZone: string): string | null {
  if (iso == null || iso === '') return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return timeFormatterFor(timeZone).format(date);
}
