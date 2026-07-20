// Utilitário mínimo e testado de composição de classes (6.3.3 §20).
// Sem biblioteca externa para juntar strings.

export type ClassValue = string | false | null | undefined;

export function cx(...values: readonly ClassValue[]): string {
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0).join(' ');
}
