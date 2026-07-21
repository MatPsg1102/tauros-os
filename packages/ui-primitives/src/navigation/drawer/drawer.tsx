// Drawer (6.3.6 §11) — DECISÃO FORMAL: Drawer = Dialog com posicionamento
// lateral (composição). ZERO segunda fundação: portal, foco, scroll lock,
// pilha e dismiss vêm de Dialog/overlay 6.3.5. Nome acessível herdado
// obrigatório (DialogAccessibleNameError). Pode conter Sidebar/
// NavigationGroup sem conhecer suas regras.

'use client';

import { type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { Dialog, type DialogProps } from '../../feedback/dialog/dialog.js';

export interface DrawerProps extends Omit<DialogProps, 'position'> {
  readonly side?: 'left' | 'right';
}

export function Drawer({ side = 'left', className, ...rest }: DrawerProps): ReactNode {
  return <Dialog {...rest} position={side} className={cx('t-drawer', className)} />;
}
