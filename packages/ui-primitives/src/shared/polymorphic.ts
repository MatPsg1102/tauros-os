// Polimorfismo tipado (6.3.3 §4) — sem `any`.
// Preserva props nativas do elemento efetivo, evita conflito com props próprias
// e mantém a tipagem do ref correspondente ao elemento renderizado.

import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  ElementType,
  PropsWithChildren,
} from 'react';

type AsProp<E extends ElementType> = { readonly as?: E };

type OmitConflicts<E extends ElementType, P> = Omit<ComponentPropsWithoutRef<E>, keyof P | 'as'>;

/** Ref tipado do elemento efetivamente renderizado. */
export type PolymorphicRef<E extends ElementType> = ComponentPropsWithRef<E>['ref'];

/**
 * Props de um componente polimórfico. React 19: `ref` é prop comum de
 * function components — sem forwardRef (que não tipa genéricos).
 */
export type PolymorphicProps<E extends ElementType, P> = PropsWithChildren<
  P & AsProp<E> & { readonly ref?: PolymorphicRef<E> } & OmitConflicts<E, P>
>;
