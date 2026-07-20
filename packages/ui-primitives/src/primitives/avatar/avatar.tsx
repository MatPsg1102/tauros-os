// Avatar (6.3.3 §13) — fallback determinístico por iniciais; imagem opcional
// com queda controlada para iniciais em erro de carregamento.

import { forwardRef, useState, type HTMLAttributes } from 'react';

import { initialsOf } from '../../shared/accessibility.js';
import { cx } from '../../shared/class-names.js';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Nome da pessoa — fonte das iniciais e do texto alternativo. */
  readonly name: string;
  readonly src?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly shape?: 'circle' | 'square';
  /** `true` quando o nome já aparece ao lado (evita anúncio duplicado). */
  readonly decorative?: boolean;
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, src, size = 'md', shape = 'circle', decorative = false, className, ...rest },
  ref,
) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== undefined && !failed;

  return (
    <span
      {...rest}
      ref={ref}
      className={cx('t-avatar', className)}
      data-size={size}
      data-shape={shape}
      {...(decorative ? { 'aria-hidden': 'true' as const } : { role: 'img', 'aria-label': name })}
    >
      {showImage ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
});
