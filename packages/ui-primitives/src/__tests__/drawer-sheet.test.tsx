// Drawer e BottomSheet (6.3.6 §11/§12) — fundação ÚNICA reutilizada de
// Dialog/overlay 6.3.5 (sem segundo portal/trap/lock/stack).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  BottomSheet,
  Dialog,
  DialogAccessibleNameError,
  Drawer,
  NavigationItem,
  Sidebar,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function surface(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]');
}

describe('Drawer', () => {
  it('reutiliza Dialog: role, aria-modal, scroll lock e camada posicionada', () => {
    const { unmount } = render(
      withTheme(
        <Drawer defaultOpen title="Navegação" side="right">
          <button>dentro</button>
        </Drawer>,
      ),
    );
    const el = surface() as HTMLElement;
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.classList.contains('t-drawer')).toBe(true);
    expect(document.body.querySelector('.t-dialog-layer')?.getAttribute('data-position')).toBe(
      'right',
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    // remoção inesperada libera o scroll (release idempotente da fundação)
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('exige nome acessível (erro herdado da fundação)', () => {
    expect(() => render(withTheme(<Drawer defaultOpen>x</Drawer>))).toThrow(
      DialogAccessibleNameError,
    );
  });

  it('Escape fecha e restaura foco; backdrop fecha', () => {
    render(
      withTheme(
        <Drawer defaultOpen title="Menu">
          <button>item</button>
        </Drawer>,
      ),
    );
    expect(document.activeElement?.textContent).toBe('item');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(surface()).toBeNull();
  });

  it('contém Sidebar/NavigationItem sem conhecer suas regras', () => {
    const { getByRole } = render(
      withTheme(
        <Drawer defaultOpen title="Navegação móvel">
          <Sidebar label="Menu principal">
            <NavigationItem label="Estoque" link={{ href: '/estoque' }} current />
          </Sidebar>
        </Drawer>,
      ),
    );
    expect(getByRole('navigation', { name: 'Menu principal' })).toBeTruthy();
    expect(getByRole('link', { name: 'Estoque' }).getAttribute('aria-current')).toBe('page');
  });

  it('nested: Drawer + Dialog fecham em ordem determinística', () => {
    render(
      withTheme(
        <Drawer defaultOpen title="Externo">
          <Dialog defaultOpen title="Interno">
            interno
          </Dialog>
        </Drawer>,
      ),
    );
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(surface()?.classList.contains('t-drawer')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(surface()).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('SSR: fechado e aberto não emitem markup no servidor (portal cliente)', () => {
    const html = renderToString(
      withTheme(
        <Drawer defaultOpen title="SSR">
          x
        </Drawer>,
      ),
    );
    expect(html).not.toContain('role="dialog"');
  });
});

describe('BottomSheet', () => {
  it('é a variante bottom da mesma fundação (posição + ergonomia móvel)', () => {
    render(
      withTheme(
        <BottomSheet defaultOpen title="Ações rápidas" closeLabel="Fechar">
          <button>ação</button>
        </BottomSheet>,
      ),
    );
    const el = surface() as HTMLElement;
    expect(el.classList.contains('t-bottomsheet')).toBe(true);
    expect(document.body.querySelector('.t-dialog-layer')?.getAttribute('data-position')).toBe(
      'bottom',
    );
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('fecha pelo botão rotulado e restaura scroll', () => {
    const { getByRole } = render(
      withTheme(
        <BottomSheet defaultOpen title="A" closeLabel="Fechar painel">
          x
        </BottomSheet>,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'Fechar painel' }));
    expect(surface()).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
