// Guardas de acessibilidade com erros orientados (P7 — 6.3.3 §21).

export class MissingAccessibleNameError extends Error {
  constructor(component: string) {
    super(
      `${component} exige nome acessível: forneça \`aria-label\` (ou \`aria-labelledby\`). ` +
        `Sem ele, leitores de tela anunciam um controle sem significado.`,
    );
    this.name = 'MissingAccessibleNameError';
  }
}

/** Lança em desenvolvimento quando um controle icônico não tem nome acessível. */
export function assertAccessibleName(
  component: string,
  props: { 'aria-label'?: string | undefined; 'aria-labelledby'?: string | undefined },
): void {
  const hasName =
    (props['aria-label'] !== undefined && props['aria-label'].trim() !== '') ||
    (props['aria-labelledby'] !== undefined && props['aria-labelledby'].trim() !== '');
  if (!hasName) throw new MissingAccessibleNameError(component);
}

/** Iniciais determinísticas para Avatar (mesmo nome ⇒ mesmas iniciais). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}
