// Estado de CLIENTE do operador ativo (7.2). ADR-018A §4 autoriza store de
// cliente exatamente para isto: "operador ativo selecionado". Não guarda
// segredo (o PIN é descartado na identificação), não guarda config e não é
// fonte de permissão — a autorização efetiva continua sendo revalidada pela
// APLICAÇÃO a cada operação (ADR-018).
//
// Vive em memória de propósito: um reload exige nova identificação. Os DADOS
// (turno, tarefas, execuções) sobrevivem no armazenamento local.

'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { EffectiveAuthorization } from '@tauros/contracts';

export interface IdentifiedOperatorView {
  readonly employeeId: string;
  /** Identidade de plataforma — null até provisionamento server-side (ADR-021). */
  readonly profileId: string | null;
  readonly membershipId: string | null;
  readonly name: string;
  readonly permissions: readonly string[];
}

export interface OperatorSessionState {
  readonly operator: IdentifiedOperatorView | null;
  readonly authorization: EffectiveAuthorization | null;
}

interface OperatorSessionContextValue extends OperatorSessionState {
  readonly identify: (
    operator: IdentifiedOperatorView,
    authorization: EffectiveAuthorization,
  ) => void;
  readonly clear: () => void;
}

const OperatorSessionContext = createContext<OperatorSessionContextValue | null>(null);

export function OperatorSessionProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [state, setState] = useState<OperatorSessionState>({
    operator: null,
    authorization: null,
  });

  const identify = useCallback(
    (operator: IdentifiedOperatorView, authorization: EffectiveAuthorization) => {
      setState({ operator, authorization });
    },
    [],
  );
  const clear = useCallback(() => {
    setState({ operator: null, authorization: null });
  }, []);

  const value = useMemo<OperatorSessionContextValue>(
    () => ({ ...state, identify, clear }),
    [state, identify, clear],
  );
  return (
    <OperatorSessionContext.Provider value={value}>{children}</OperatorSessionContext.Provider>
  );
}

export function useOperatorSession(): OperatorSessionContextValue {
  const value = useContext(OperatorSessionContext);
  if (value === null) throw new Error('OperatorSessionProvider ausente');
  return value;
}
