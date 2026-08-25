// Foto V1.1 — captura direta por câmera (celular/tablet) + galeria, com
// preview e confirmação, no MESMO fluxo de evidência existente (nenhum
// sistema novo). Container real em memória; o time demo semeado dá a
// elegibilidade (Rita/Apoio finaliza a tarefa com foto obrigatória).

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MemoryLocalStore, OFFLINE_SCHEMA } from '@tauros/infrastructure';

import OperacaoPage from '../src/app/operacao/page.js';
import { AppProviders } from '../src/app/providers.js';
import { APP_STATE_SCHEMA, MemoryEvidenceBlobStore } from '../src/wiring/adapters.js';
import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FakeSessionSyncTransport } from '../src/wiring/transport-fake.js';
import { resetNavigations } from './setup-router.js';

const NOW = new Date('2026-08-13T14:00:00.000Z'); // 11:00 na loja

let container: AppContainer;

function makeWorld(): void {
  container = buildContainer({
    clock: () => NOW,
    deviceId: 'device-A',
    offlineStore: new MemoryLocalStore(OFFLINE_SCHEMA),
    appStore: new MemoryLocalStore(APP_STATE_SCHEMA),
    transport: new FakeSessionSyncTransport(),
    deviceOnline: () => true,
    evidenceBlobs: new MemoryEvidenceBlobStore(),
  });
}

function app(): ReactElement {
  return (
    <AppProviders container={container}>
      <OperacaoPage />
    </AppProviders>
  );
}

async function enterPinAndConfirm(name: string, pin: string): Promise<void> {
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('combobox'), {
    target: {
      value: (within(dialog).getByRole('option', { name }) as HTMLOptionElement).value,
    },
  });
  const cells = within(dialog).getAllByLabelText(/Dígito \d de 6/);
  pin.split('').forEach((digit, index) => {
    fireEvent.keyDown(cells[index] as HTMLElement, { key: digit });
  });
  fireEvent.click(within(dialog).getByRole('button', { name: /Confirmar/ }));
}

async function openDay(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir o dia' }));
  await enterPinAndConfirm('Elber', '123456');
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

/** Abre o drawer de finalização da limpeza final (Apoio) com a Rita. */
async function openSubmitDrawer(): Promise<void> {
  const heading = await screen.findByRole('heading', { name: 'Checar limpeza final do salão' });
  const card = heading.closest('div[class]') as HTMLElement;
  fireEvent.click(within(card).getByRole('button', { name: 'Iniciar' }));
  await enterPinAndConfirm('Rita Belmonte', '997755');
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  fireEvent.click(within(card).getByRole('button', { name: 'Finalizar' }));
  await enterPinAndConfirm('Rita Belmonte', '997755');
  await screen.findByRole('button', { name: 'Abrir câmera' });
}

function photo(name = 'evidencia.jpg'): File {
  return new File([`conteudo-${name}`], name, { type: 'image/jpeg' });
}

beforeEach(() => {
  makeWorld();
  resetNavigations();
  URL.createObjectURL = (() => 'blob:fake-preview') as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
});

afterEach(cleanup);

describe('Foto V1.1 — captura por câmera e galeria com preview', () => {
  it('oferece Abrir câmera (capture=environment) e Escolher foto (sem capture)', async () => {
    render(app());
    await openDay();
    await openSubmitDrawer();

    expect(screen.getByRole('button', { name: 'Abrir câmera' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher foto' })).toBeTruthy();

    const camera = screen.getByLabelText('Capturar pela câmera') as HTMLInputElement;
    expect(camera.getAttribute('accept')).toBe('image/*');
    expect(camera.getAttribute('capture')).toBe('environment');

    const pick = screen.getByLabelText('Adicionar foto') as HTMLInputElement;
    expect(pick.getAttribute('accept')).toBe('image/*');
    expect(pick.hasAttribute('capture')).toBe(false); // galeria NUNCA força câmera
  });

  it('seleção mostra preview e SÓ "Usar foto" persiste a evidência', async () => {
    render(app());
    await openDay();
    await openSubmitDrawer();

    fireEvent.change(screen.getByLabelText('Adicionar foto'), { target: { files: [photo()] } });
    await screen.findByAltText('Pré-visualização da foto');
    // preview NÃO é evidência: nada persistido ainda
    expect(screen.queryByAltText('Evidência registrada')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Usar foto' }));
    await screen.findByAltText('Evidência registrada');
    expect(screen.queryByAltText('Pré-visualização da foto')).toBeNull();
  });

  it('captura pela câmera passa pelo mesmo preview e confirma', async () => {
    render(app());
    await openDay();
    await openSubmitDrawer();

    fireEvent.change(screen.getByLabelText('Capturar pela câmera'), {
      target: { files: [photo('camera.jpg')] },
    });
    await screen.findByAltText('Pré-visualização da foto');
    fireEvent.click(screen.getByRole('button', { name: 'Usar foto' }));
    await screen.findByAltText('Evidência registrada');
  });

  it('"Tirar outra" substitui a pendente; "Descartar" não cria evidência', async () => {
    render(app());
    await openDay();
    await openSubmitDrawer();

    fireEvent.change(screen.getByLabelText('Adicionar foto'), {
      target: { files: [photo('primeira.jpg')] },
    });
    await screen.findByAltText('Pré-visualização da foto');
    // trocar: nova seleção substitui a pendente (segue UMA pré-visualização)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar outra' }));
    fireEvent.change(screen.getByLabelText('Adicionar foto'), {
      target: { files: [photo('segunda.jpg')] },
    });
    expect(screen.getAllByAltText('Pré-visualização da foto')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByAltText('Pré-visualização da foto')).toBeNull();
    expect(screen.queryByAltText('Evidência registrada')).toBeNull();
    // e o envio com foto OBRIGATÓRIA continua bloqueado sem evidência
    fireEvent.click(screen.getByRole('button', { name: 'Concluir tarefa' }));
    await screen.findByText('Adicione a foto solicitada antes de enviar para conferência.');
    expect(screen.queryByText('Tarefa concluída.')).toBeNull();
  });

  it('cancelar o drawer com preview pendente não persiste nada (reabre limpo)', async () => {
    render(app());
    await openDay();
    await openSubmitDrawer();

    fireEvent.change(screen.getByLabelText('Adicionar foto'), { target: { files: [photo()] } });
    await screen.findByAltText('Pré-visualização da foto');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // reabrir: sem pendente, sem evidência criada
    const heading = await screen.findByRole('heading', { name: 'Checar limpeza final do salão' });
    const card = heading.closest('div[class]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Finalizar' }));
    await enterPinAndConfirm('Rita Belmonte', '997755');
    await screen.findByRole('button', { name: 'Abrir câmera' });
    expect(screen.queryByAltText('Pré-visualização da foto')).toBeNull();
    expect(screen.queryByAltText('Evidência registrada')).toBeNull();
  });
});
