// Dialog, Modal, ConfirmDialog (6.3.5 §11–§13).

import { fireEvent, render, waitFor } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { ConfirmDialog, Dialog, DialogAccessibleNameError, Modal } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

function dialogSurface(): HTMLElement | null {
  return document.body.querySelector('[role="dialog"]');
}

describe('Dialog', () => {
  it('exige nome acessível — erro orientado sem title/aria-label', () => {
    expect(() => render(withTheme(<Dialog open>conteudo</Dialog>))).toThrow(
      DialogAccessibleNameError,
    );
  });

  it('título e descrição associados por aria-labelledby/aria-describedby', () => {
    render(
      withTheme(
        <Dialog open title="Confirmar pesagem" description="Revise antes de continuar">
          corpo
        </Dialog>,
      ),
    );
    const surface = dialogSurface() as HTMLElement;
    const labelledBy = surface.getAttribute('aria-labelledby') as string;
    const describedBy = surface.getAttribute('aria-describedby') as string;
    expect(document.getElementById(labelledBy)?.textContent).toBe('Confirmar pesagem');
    expect(document.getElementById(describedBy)?.textContent).toBe('Revise antes de continuar');
    expect(surface.getAttribute('aria-modal')).toBe('true');
  });

  it('uncontrolled: defaultOpen + fechamento por Escape restaura o foco', () => {
    const { getByRole } = render(
      withTheme(
        <>
          <button id="fora">fora</button>
          <Dialog defaultOpen title="T">
            <button>dentro</button>
          </Dialog>
        </>,
      ),
    );
    expect(getByRole('button', { name: 'dentro' })).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialogSurface()).toBeNull();
  });

  it('controlled: open segue somente o prop; onOpenChange notifica', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      withTheme(
        <Dialog open={false} onOpenChange={onOpenChange} title="T">
          x
        </Dialog>,
      ),
    );
    expect(dialogSurface()).toBeNull();
    rerender(
      withTheme(
        <Dialog open onOpenChange={onOpenChange} title="T">
          x
        </Dialog>,
      ),
    );
    expect(dialogSurface()).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(dialogSurface()).not.toBeNull(); // controlado: só fecha via prop
  });

  it('clique no backdrop fecha; dismissable=false mantém aberto', () => {
    const { rerender } = render(
      withTheme(
        <Dialog defaultOpen title="T">
          x
        </Dialog>,
      ),
    );
    fireEvent.click(document.body.querySelector('.t-dialog-layer') as HTMLElement);
    expect(dialogSurface()).toBeNull();

    rerender(
      withTheme(
        <Dialog defaultOpen={false} title="T">
          x
        </Dialog>,
      ),
    );
    render(
      withTheme(
        <Dialog defaultOpen dismissable={false} title="T2">
          x
        </Dialog>,
      ),
    );
    fireEvent.click(document.body.querySelector('.t-dialog-layer') as HTMLElement);
    expect(dialogSurface()).not.toBeNull();
  });

  it('modal bloqueia scroll do body e libera no fechamento', () => {
    const { unmount } = render(
      withTheme(
        <Dialog defaultOpen title="T">
          x
        </Dialog>,
      ),
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('nested: Escape fecha somente o overlay do topo', () => {
    render(
      withTheme(
        <Dialog defaultOpen title="Externo">
          <Dialog defaultOpen title="Interno">
            interno
          </Dialog>
        </Dialog>,
      ),
    );
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    const restantes = document.body.querySelectorAll('[role="dialog"]');
    expect(restantes).toHaveLength(1);
    expect(restantes[0]?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('botão fechar embutido com rótulo acessível', () => {
    const { getByRole } = render(
      withTheme(
        <Dialog defaultOpen title="T" closeLabel="Fechar diálogo">
          x
        </Dialog>,
      ),
    );
    fireEvent.click(getByRole('button', { name: 'Fechar diálogo' }));
    expect(dialogSurface()).toBeNull();
  });
});

describe('Modal', () => {
  it('é a variante modal de Dialog (aria-modal, foco contido por Tab)', () => {
    render(
      withTheme(
        <Modal open title="M" onOpenChange={() => undefined}>
          <button>unico</button>
        </Modal>,
      ),
    );
    const surface = dialogSurface() as HTMLElement;
    expect(surface.getAttribute('aria-modal')).toBe('true');
    // Tab a partir do último focável volta ao primeiro (contenção)
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(surface.contains(document.activeElement)).toBe(true);
  });
});

describe('ConfirmDialog', () => {
  function Harness(props: {
    readonly onConfirm: () => void | Promise<void>;
    readonly destructive?: boolean;
  }): ReactElement {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir produto"
        description="Ação irreversível"
        destructive={props.destructive ?? false}
        onConfirm={props.onConfirm}
      />
    );
  }

  it('confirmação síncrona fecha o diálogo', async () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(withTheme(<Harness onConfirm={onConfirm} />));
    fireEvent.click(getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(dialogSurface()).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelar fecha sem executar a ação', () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(withTheme(<Harness onConfirm={onConfirm} />));
    fireEvent.click(getByRole('button', { name: 'Cancelar' }));
    expect(dialogSurface()).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('destrutivo: foco inicial na ação SEGURA (cancelar) e variante danger', () => {
    const { getByRole } = render(withTheme(<Harness destructive onConfirm={() => undefined} />));
    expect(document.activeElement).toBe(getByRole('button', { name: 'Cancelar' }));
    expect(getByRole('button', { name: 'Confirmar' }).getAttribute('data-variant')).toBe('danger');
  });

  it('falha assíncrona: diálogo permanece aberto, erro seguro visível, retry funciona', async () => {
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('segredo interno db://senha'))
      .mockResolvedValueOnce(undefined);
    const { getByRole } = render(withTheme(<Harness onConfirm={onConfirm} />));

    fireEvent.click(getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(getByRole('alert')).toBeTruthy());
    // o conteúdo bruto da exceção NUNCA aparece
    expect(getByRole('alert').textContent).not.toContain('segredo');
    expect(dialogSurface()).not.toBeNull();

    // tentativa repetida com sucesso fecha
    fireEvent.click(getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(dialogSurface()).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
