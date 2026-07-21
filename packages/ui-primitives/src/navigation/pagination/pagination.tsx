// Pagination (6.3.6 §10) — navegação paginada sem backend. Links (adapter
// neutro via getPageHref) OU callbacks (onPageChange); semântica correta:
// links quando há href, botões caso contrário. Casos definidos: 0 páginas ⇒
// nada; 1 página ⇒ navegação desabilitada; página fora do intervalo ⇒
// clamp previsível; janela com reticências para totais altos.

'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../shared/class-names.js';
import { handleAdapterClick, type NavigationLinkAdapter } from '../shared/link.js';

export interface PaginationLabels {
  readonly navigation: string;
  readonly first: string;
  readonly previous: string;
  readonly next: string;
  readonly last: string;
  readonly page: (page: number) => string;
}

/** Defaults oficiais pt-BR — todos substituíveis por props (i18n). */
const DEFAULT_LABELS: PaginationLabels = {
  navigation: 'Paginação',
  first: 'Primeira página',
  previous: 'Página anterior',
  next: 'Próxima página',
  last: 'Última página',
  page: (page) => `Página ${String(page)}`,
};

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange?: (page: number) => void;
  /** Modo link: adapter neutro por página (SSR-friendly). */
  readonly getPageLink?: (page: number) => NavigationLinkAdapter;
  /** Vizinhos de cada lado da página atual na janela. */
  readonly siblingCount?: number;
  readonly labels?: Partial<PaginationLabels>;
  readonly disabled?: boolean;
}

/** Janela determinística de páginas com reticências (exportada p/ teste via render). */
function pageWindow(current: number, total: number, siblings: number): (number | 'ellipsis')[] {
  const pages = new Set<number>([1, total]);
  for (let p = current - siblings; p <= current + siblings; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const page of sorted) {
    if (prev !== 0 && page - prev > 1) out.push('ellipsis');
    out.push(page);
    prev = page;
  }
  return out;
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  {
    currentPage,
    totalPages,
    onPageChange,
    getPageLink,
    siblingCount = 1,
    labels,
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  if (totalPages <= 0) return null;
  const l: PaginationLabels = { ...DEFAULT_LABELS, ...labels };
  // clamp previsível (total pode mudar sob os pés do consumidor)
  const page = Math.min(Math.max(1, currentPage), totalPages);

  function item(
    target: number,
    label: string,
    content: ReactNode,
    options: { readonly current?: boolean; readonly blocked?: boolean } = {},
  ): ReactNode {
    const blocked = disabled || options.blocked === true;
    const link = getPageLink?.(target);
    if (link !== undefined && !blocked && options.current !== true) {
      return (
        <a
          className="t-page-item t-focusable"
          href={link.href}
          aria-label={label}
          onClick={(event) => {
            handleAdapterClick(event, link);
            onPageChange?.(target);
          }}
        >
          {content}
        </a>
      );
    }
    return (
      <button
        type="button"
        className="t-page-item t-focusable"
        aria-label={label}
        aria-current={options.current === true ? 'page' : undefined}
        data-current={options.current === true ? 'true' : undefined}
        disabled={blocked}
        onClick={() => {
          if (options.current !== true) onPageChange?.(target);
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <nav {...rest} ref={ref} aria-label={l.navigation} className={cx('t-pagination', className)}>
      <ul className="t-pagination-list">
        <li>{item(1, l.first, <span aria-hidden="true">«</span>, { blocked: page === 1 })}</li>
        <li>
          {item(page - 1, l.previous, <span aria-hidden="true">‹</span>, { blocked: page === 1 })}
        </li>
        {pageWindow(page, totalPages, siblingCount).map((entry, index) =>
          entry === 'ellipsis' ? (
            <li key={`e-${String(index)}`} className="t-page-ellipsis" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={entry}>
              {item(entry, l.page(entry), String(entry), { current: entry === page })}
            </li>
          ),
        )}
        <li>
          {item(page + 1, l.next, <span aria-hidden="true">›</span>, {
            blocked: page === totalPages,
          })}
        </li>
        <li>
          {item(totalPages, l.last, <span aria-hidden="true">»</span>, {
            blocked: page === totalPages,
          })}
        </li>
      </ul>
    </nav>
  );
});
