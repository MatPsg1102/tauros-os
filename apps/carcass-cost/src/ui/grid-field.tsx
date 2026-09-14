// Field para células de Grid: o controle fica alinhado à BASE da célula, de
// modo que um rótulo de duas linhas não desalinhe o campo vizinho na mesma
// linha (as células do Grid esticam; o Field é coluna flex — margin-top auto
// empurra o controle para baixo). Fora de um Grid não muda nada.

import { Field, type FieldProps } from '@tauros/ui-primitives';
import type { ReactElement } from 'react';

export function GridField({ children, ...field }: FieldProps): ReactElement {
  return (
    <Field {...field}>
      <div style={{ marginTop: 'auto' }}>{children}</div>
    </Field>
  );
}
