// BottomSheet (6.3.6 §12) — DECISÃO FORMAL: Drawer posicionado no bottom
// (mesmo contrato de Dialog; ergonomia móvel: altura máxima, conteúdo
// rolável, safe area via CSS). Gesto de arrastar NÃO está congelado —
// não implementado, sem dependência de gesture (pendência registrada).

'use client';

import { type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Dialog, type DialogProps } from '../../feedback/dialog/dialog.js';

export type BottomSheetProps = Omit<DialogProps, 'position'>;

export function BottomSheet({ className, ...rest }: BottomSheetProps): ReactNode {
  return <Dialog {...rest} position="bottom" className={cx('t-bottomsheet', className)} />;
}
