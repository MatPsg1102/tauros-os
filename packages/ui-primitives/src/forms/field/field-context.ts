// Contexto interno de campo (6.3.4 §1/§16) — Field fornece IDs e estados;
// controles consomem sem duplicar label/descrição/erro/aria em cada um.
// Props do consumidor SEMPRE têm precedência sobre o contexto.

'use client';

import { createContext, useContext } from 'react';

export interface FieldContextValue {
  readonly controlId: string;
  readonly labelId: string;
  readonly descriptionId: string | undefined;
  readonly errorId: string | undefined;
  readonly required: boolean;
  readonly invalid: boolean;
  readonly disabled: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

/** Contexto do Field envolvente, ou null quando o controle está isolado. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

/** Compõe listas de IDs sem duplicação, preservando os do consumidor. */
export function composeIds(...ids: readonly (string | undefined)[]): string | undefined {
  const seen: string[] = [];
  for (const id of ids) {
    if (id === undefined) continue;
    for (const part of id.split(/\s+/)) {
      if (part !== '' && !seen.includes(part)) seen.push(part);
    }
  }
  return seen.length === 0 ? undefined : seen.join(' ');
}

export interface ControlWiringInput {
  readonly id?: string | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly invalid?: boolean | undefined;
}

export interface ControlWiring {
  readonly id: string | undefined;
  readonly describedBy: string | undefined;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly invalid: boolean;
}

/** Resolve id/aria/estados do controle a partir de props + contexto de Field. */
export function resolveControlWiring(
  props: ControlWiringInput,
  field: FieldContextValue | null,
): ControlWiring {
  return {
    id: props.id ?? field?.controlId,
    describedBy: composeIds(props['aria-describedby'], field?.descriptionId, field?.errorId),
    required: props.required ?? field?.required ?? false,
    disabled: props.disabled ?? field?.disabled ?? false,
    invalid: props.invalid ?? field?.invalid ?? false,
  };
}
