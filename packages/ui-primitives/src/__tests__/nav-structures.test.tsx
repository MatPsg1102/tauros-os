// Sidebar, TopBar, NavigationBar, Fab, SegmentedControl (6.3.6 §5/§6 + 5.3).

import { fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import {
  Button,
  Fab,
  MissingAccessibleNameError,
  NavigationBar,
  NavigationItem,
  SegmentedControl,
  Sidebar,
  TopBar,
} from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('Sidebar', () => {
  it('nav com nome acessível; colapso não controlado propaga aos itens', () => {
    const { getByRole } = render(
      withTheme(
        <Sidebar toggleLabel="Alternar navegação">
          <NavigationItem label="Estoque" link={{ href: '/estoque' }} />
        </Sidebar>,
      ),
    );
    const nav = getByRole('navigation', { name: 'Navegação principal' });
    expect(nav.getAttribute('data-collapsed')).toBeNull();
    const item = getByRole('link', { name: 'Estoque' });
    expect(item.querySelector('.t-visually-hidden')).toBeNull();

    fireEvent.click(getByRole('button', { name: 'Alternar navegação' }));
    expect(nav.getAttribute('data-collapsed')).toBe('true');
    // colapsada: label vira visually-hidden — nome acessível PRESERVADO
    expect(item.querySelector('.t-visually-hidden')).not.toBeNull();
    expect(getByRole('link', { name: 'Estoque' })).toBe(item);
  });

  it('modo controlado segue o prop; nenhuma persistência interna em storage', () => {
    const onCollapsedChange = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { getByRole } = render(
      withTheme(
        <Sidebar collapsed={false} onCollapsedChange={onCollapsedChange} toggleLabel="Alternar">
          <NavigationItem label="A" link={{ href: '/a' }} />
        </Sidebar>,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'Alternar' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(getByRole('navigation').getAttribute('data-collapsed')).toBeNull(); // controlado
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('header e footer como slots', () => {
    const { getByText } = render(
      withTheme(
        <Sidebar header={<span>Tauros</span>} footer={<span>v1</span>}>
          <NavigationItem label="A" link={{ href: '/a' }} />
        </Sidebar>,
      ),
    );
    expect(getByText('Tauros')).toBeTruthy();
    expect(getByText('v1')).toBeTruthy();
  });
});

describe('TopBar', () => {
  it('slots leading/title/navigation/actions/trailing; título vira h1', () => {
    const { getByRole, getByText } = render(
      withTheme(
        <TopBar
          leading={<span>logo</span>}
          title="Produção"
          navigation={<span>ctx</span>}
          actions={<Button size="sm">Nova tarefa</Button>}
          trailing={<span>avatar</span>}
        />,
      ),
    );
    expect(getByRole('banner')).toBeTruthy();
    expect(getByRole('heading', { level: 1, name: 'Produção' })).toBeTruthy();
    expect(getByText('logo')).toBeTruthy();
    expect(getByRole('button', { name: 'Nova tarefa' })).toBeTruthy();
  });

  it('sticky é declarativo via data-attribute (z tokenizado no CSS)', () => {
    const { getByRole, rerender } = render(withTheme(<TopBar title="A" />));
    expect(getByRole('banner').getAttribute('data-sticky')).toBeNull();
    rerender(withTheme(<TopBar title="A" sticky />));
    expect(getByRole('banner').getAttribute('data-sticky')).toBe('true');
  });
});

describe('NavigationBar (5.3 — barra inferior móvel)', () => {
  it('nav rotulada com itens uniformes; fixed declarativo', () => {
    const { getByRole, rerender } = render(
      withTheme(
        <NavigationBar>
          <NavigationItem label="Início" link={{ href: '/' }} current />
          <NavigationItem label="Tarefas" link={{ href: '/t' }} />
        </NavigationBar>,
      ),
    );
    const nav = getByRole('navigation', { name: 'Navegação inferior' });
    expect(nav.getAttribute('data-fixed')).toBeNull();
    expect(getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page');
    rerender(
      withTheme(
        <NavigationBar fixed>
          <NavigationItem label="Início" link={{ href: '/' }} />
        </NavigationBar>,
      ),
    );
    expect(getByRole('navigation').getAttribute('data-fixed')).toBe('true');
  });
});

describe('Fab (5.3)', () => {
  it('ícone-só exige e usa aria-label; extended mostra rótulo visível', () => {
    const { getByRole, rerender } = render(
      withTheme(<Fab label="Nova pesagem" icon={<span>+</span>} />),
    );
    expect(getByRole('button', { name: 'Nova pesagem' }).classList.contains('t-fab')).toBe(true);
    rerender(withTheme(<Fab label="Nova pesagem" icon={<span>+</span>} extended />));
    const btn = getByRole('button', { name: 'Nova pesagem' });
    expect(btn.getAttribute('data-extended')).toBe('true');
    expect(btn.textContent).toContain('Nova pesagem');
  });
});

describe('SegmentedControl (5.3)', () => {
  const options = [
    { value: 'dia', label: 'Dia' },
    { value: 'semana', label: 'Semana' },
    { value: 'mes', label: 'Mês', disabled: true },
  ];

  it('exige nome acessível (erro orientado)', () => {
    expect(() => render(withTheme(<SegmentedControl options={options} />))).toThrow(
      MissingAccessibleNameError,
    );
  });

  it('radiogroup nativo: seleção, disabled e modo controlado', () => {
    const onValueChange = vi.fn();
    const { getByRole, getAllByRole } = render(
      withTheme(
        <SegmentedControl
          aria-label="Período"
          options={options}
          defaultValue="dia"
          onValueChange={onValueChange}
        />,
      ),
    );
    expect(getByRole('radiogroup', { name: 'Período' })).toBeTruthy();
    const radios = getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]?.checked).toBe(true);
    expect(radios[2]?.disabled).toBe(true);
    fireEvent.click(radios[1] as HTMLInputElement);
    expect(onValueChange).toHaveBeenCalledWith('semana', expect.anything());
    expect(radios[1]?.checked).toBe(true);
  });
});
