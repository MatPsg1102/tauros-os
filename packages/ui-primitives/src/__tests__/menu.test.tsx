// Menu e ContextMenu (6.3.6 §13/§14) — contrato semântico próprio.

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuContextMissingError,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  MissingAccessibleNameError,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function basicMenu(onSelect: (v: string) => void = () => undefined): ReactElement {
  return withTheme(
    <Menu>
      <MenuTrigger>Ações</MenuTrigger>
      <MenuContent aria-label="Ações do item">
        <MenuLabel>Operação</MenuLabel>
        <MenuItem onSelect={() => onSelect('editar')}>Editar</MenuItem>
        <MenuItem onSelect={() => onSelect('pesar')}>Pesar novamente</MenuItem>
        <MenuSeparator />
        <MenuItem disabled onSelect={() => onSelect('excluir')}>
          Excluir
        </MenuItem>
      </MenuContent>
    </Menu>,
  );
}

function openMenu(getByRole: (role: string, opts?: object) => HTMLElement): HTMLElement {
  fireEvent.click(getByRole('button', { name: 'Ações' }));
  return document.body.querySelector('[role="menu"]') as HTMLElement;
}

describe('Menu', () => {
  it('trigger com aria-haspopup/expanded/controls; abre e foca o primeiro item', () => {
    const { getByRole } = render(basicMenu());
    const trigger = getByRole('button', { name: 'Ações' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const menu = openMenu(getByRole);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(document.activeElement?.textContent).toBe('Editar');
  });

  it('ArrowUp no trigger abre focando o ÚLTIMO item habilitado', () => {
    const { getByRole } = render(basicMenu());
    fireEvent.keyDown(getByRole('button', { name: 'Ações' }), { key: 'ArrowUp' });
    // 'Excluir' é disabled — último habilitado é 'Pesar novamente'
    expect(document.activeElement?.textContent).toBe('Pesar novamente');
  });

  it('setas com wrap pulando disabled; Home/End; Escape fecha e restaura o trigger', () => {
    const { getByRole } = render(basicMenu());
    const menu = openMenu(getByRole);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Pesar novamente');
    fireEvent.keyDown(menu, { key: 'ArrowDown' }); // pula Excluir (disabled) → wrap
    expect(document.activeElement?.textContent).toBe('Editar');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement?.textContent).toBe('Pesar novamente');
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement?.textContent).toBe('Editar');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(getByRole('button', { name: 'Ações' }));
  });

  it('seleção fecha o menu e executa onSelect; disabled não dispara', () => {
    const onSelect = vi.fn();
    const { getByRole } = render(basicMenu(onSelect));
    openMenu(getByRole);
    fireEvent.click(getByRole('menuitem', { name: 'Editar' }));
    expect(onSelect).toHaveBeenCalledWith('editar');
    expect(document.body.querySelector('[role="menu"]')).toBeNull();

    openMenu(getByRole);
    fireEvent.click(getByRole('menuitem', { name: 'Excluir' }));
    expect(onSelect).not.toHaveBeenCalledWith('excluir');
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
  });

  it('typeahead foca o item pelo prefixo digitado', () => {
    const { getByRole } = render(basicMenu());
    const menu = openMenu(getByRole);
    fireEvent.keyDown(menu, { key: 'p' });
    expect(document.activeElement?.textContent).toBe('Pesar novamente');
  });

  it('clique externo fecha (pointerdown fora)', () => {
    const { getByRole } = render(basicMenu());
    openMenu(getByRole);
    fireEvent.pointerDown(document.body);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('checkbox alterna aria-checked e permanece aberto; radio group seleciona', () => {
    const onChecked = vi.fn();
    const onValue = vi.fn();
    const { getByRole } = render(
      withTheme(
        <Menu defaultOpen>
          <MenuTrigger>Filtro</MenuTrigger>
          <MenuContent aria-label="Filtros">
            <MenuCheckboxItem checked={false} onCheckedChange={onChecked}>
              Somente ativos
            </MenuCheckboxItem>
            <MenuRadioGroup value="dia" onValueChange={onValue}>
              <MenuRadioItem value="dia">Por dia</MenuRadioItem>
              <MenuRadioItem value="semana">Por semana</MenuRadioItem>
            </MenuRadioGroup>
          </MenuContent>
        </Menu>,
      ),
    );
    const checkbox = getByRole('menuitemcheckbox', { name: 'Somente ativos' });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(checkbox);
    expect(onChecked).toHaveBeenCalledWith(true);
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull(); // permanece aberto

    const radioDia = getByRole('menuitemradio', { name: 'Por dia' });
    expect(radioDia.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(getByRole('menuitemradio', { name: 'Por semana' }));
    expect(onValue).toHaveBeenCalledWith('semana');
  });

  it('MenuItem sem nome acessível lança erro orientado', () => {
    expect(() =>
      render(
        withTheme(
          <Menu defaultOpen>
            <MenuTrigger>T</MenuTrigger>
            <MenuContent aria-label="X">
              <MenuItem onSelect={() => undefined}>{''}</MenuItem>
            </MenuContent>
          </Menu>,
        ),
      ),
    ).toThrow(MissingAccessibleNameError);
  });

  it('partes fora de <Menu> lançam erro orientado; SSR não emite menu', () => {
    expect(() => render(withTheme(<MenuTrigger>solto</MenuTrigger>))).toThrow(
      MenuContextMissingError,
    );
    const html = renderToString(basicMenu());
    expect(html).not.toContain('role="menu"');
  });
});

describe('ContextMenu', () => {
  function makeContextMenu(onSelect: (v: string) => void = () => undefined): ReactElement {
    return withTheme(
      <ContextMenu>
        <ContextMenuTrigger data-testid="area">área do produto</ContextMenuTrigger>
        <ContextMenuContent aria-label="Ações do produto">
          <ContextMenuItem onSelect={() => onSelect('duplicar')}>Duplicar</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onSelect('arquivar')}>Arquivar</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
  }

  it('clique secundário previne o menu nativo NA ÁREA e abre no ponto', () => {
    const { getByTestId } = render(makeContextMenu());
    const area = getByTestId('area');
    const prevented = fireEvent.contextMenu(area, { clientX: 120, clientY: 80 });
    expect(prevented).toBe(false); // preventDefault chamado
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Duplicar');
  });

  it('Shift+F10 abre pelo teclado; Escape fecha e restaura', () => {
    const { getByTestId } = render(makeContextMenu());
    const area = getByTestId('area');
    area.focus();
    fireEvent.keyDown(area, { key: 'F10', shiftKey: true });
    const menu = document.body.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('seleção executa e fecha', () => {
    const onSelect = vi.fn();
    const { getByTestId, getByRole } = render(makeContextMenu(onSelect));
    fireEvent.contextMenu(getByTestId('area'));
    fireEvent.click(getByRole('menuitem', { name: 'Arquivar' }));
    expect(onSelect).toHaveBeenCalledWith('arquivar');
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it('após unmount o menu nativo NÃO é mais bloqueado (cleanup)', () => {
    const { getByTestId, unmount } = render(makeContextMenu());
    const area = getByTestId('area');
    fireEvent.contextMenu(area);
    unmount();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });
});
