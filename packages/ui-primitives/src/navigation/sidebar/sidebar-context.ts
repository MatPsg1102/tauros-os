// Contexto interno da Sidebar — propaga colapso aos itens (sem estado global).

'use client';

import { createContext } from 'react';

export interface SidebarContextValue {
  readonly collapsed: boolean;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);
