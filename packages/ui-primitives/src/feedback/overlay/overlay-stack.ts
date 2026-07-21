// Pilha de overlays (6.3.5 §1/§4/§21) — ordem determinística de fechamento:
// Escape/clique-fora atuam SOMENTE no overlay do topo. Sem z-index
// incremental: a ordem visual vem da ordem de montagem dos portais (irmãos
// com o mesmo token de camada; o mais recente fica acima). Módulo interno.

'use client';

const stack: string[] = [];

export function pushOverlay(id: string): void {
  removeOverlay(id);
  stack.push(id);
}

export function removeOverlay(id: string): void {
  const index = stack.indexOf(id);
  if (index !== -1) stack.splice(index, 1);
}

export function isTopOverlay(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

export function overlayCount(): number {
  return stack.length;
}
