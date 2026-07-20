// Ports do Configuration Engine — implementados pela infraestrutura.
// O engine não conhece Supabase/Prisma; recebe overrides por este contrato.

import type { StoreConfigOverride } from './types.js';

/** Fonte de overrides por loja (implementação: infrastructure, Etapa 6.2+). */
export interface ConfigSourcePort {
  /**
   * Carrega TODOS os overrides vigentes e futuros da loja.
   * O engine aplica vigência e precedência; a fonte só entrega as linhas.
   */
  loadStoreOverrides(storeId: string): Promise<readonly StoreConfigOverride[]>;
}
