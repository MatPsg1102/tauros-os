// Slug ASCII estável de um nome — base de chaves naturais e de idempotência
// determinística (nunca timestamp/aleatório). Compartilhado pelos use cases.

export function nameSlug(value: string, maxLength = 60): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}
