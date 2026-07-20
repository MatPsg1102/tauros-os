// Integração React Hook Form (6.3.4 §3) — via contratos NATIVOS
// (name/onChange/onBlur/ref). RHF é devDependency exclusiva de teste.

import { act, fireEvent, render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@tauros/theme';

import { Checkbox, Field, Input, NumberInput, Select } from '../index.js';

function withTheme(ui: ReactElement): ReactElement {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

interface FormValues {
  nome: string;
  ativo: boolean;
  categoria: string;
  quantidade: number | null;
}

describe('React Hook Form', () => {
  it('register funciona com Input/Checkbox/Select via semântica nativa', async () => {
    const onSubmit = vi.fn();
    function Demo(): ReactElement {
      const { register, handleSubmit } = useForm<FormValues>({
        defaultValues: { nome: '', ativo: false, categoria: 'a', quantidade: null },
      });
      return (
        <form
          onSubmit={(e) => {
            void handleSubmit((data) => onSubmit(data))(e);
          }}
        >
          <Input aria-label="Nome" {...register('nome')} />
          <Checkbox label="Ativo" {...register('ativo')} />
          <Select aria-label="Categoria" {...register('categoria')}>
            <option value="a">A</option>
            <option value="b">B</option>
          </Select>
          <button type="submit">Enviar</button>
        </form>
      );
    }
    const { getByRole } = render(withTheme(<Demo />));
    fireEvent.change(getByRole('textbox'), { target: { value: 'Maria' } });
    fireEvent.click(getByRole('checkbox'));
    fireEvent.change(getByRole('combobox'), { target: { value: 'b' } });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Enviar' }));
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Maria', ativo: true, categoria: 'b' }),
    );
  });

  it('Controller integra NumberInput (valor numérico separado do texto)', async () => {
    const onSubmit = vi.fn();
    function Demo(): ReactElement {
      const { control, handleSubmit } = useForm<FormValues>({
        defaultValues: { nome: '', ativo: false, categoria: 'a', quantidade: null },
      });
      return (
        <form
          onSubmit={(e) => {
            void handleSubmit((data) => onSubmit(data))(e);
          }}
        >
          <Controller
            control={control}
            name="quantidade"
            render={({ field }) => (
              <NumberInput
                aria-label="Quantidade"
                value={field.value}
                onValueChange={(change) => field.onChange(change.value)}
                onBlur={field.onBlur}
              />
            )}
          />
          <button type="submit">Ok</button>
        </form>
      );
    }
    const { getByRole } = render(withTheme(<Demo />));
    fireEvent.change(getByRole('textbox'), { target: { value: '3,5' } });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Ok' }));
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ quantidade: 3.5 }));
  });

  it('reset e setValue refletem nos controles; formState registra erro externo', async () => {
    let api: ReturnType<typeof useForm<FormValues>> | undefined;
    function Demo(): ReactElement {
      const form = useForm<FormValues>({
        defaultValues: { nome: 'inicial', ativo: false, categoria: 'a', quantidade: null },
      });
      api = form;
      const error = form.formState.errors.nome?.message;
      return (
        <Field label="Nome" {...(error !== undefined ? { error } : {})}>
          <Input {...form.register('nome')} />
        </Field>
      );
    }
    const { getByRole } = render(withTheme(<Demo />));
    const input = getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('inicial');

    await act(async () => {
      api?.setValue('nome', 'novo');
    });
    expect(input.value).toBe('novo');

    await act(async () => {
      api?.reset();
    });
    expect(input.value).toBe('inicial');

    await act(async () => {
      api?.setError('nome', { message: 'Obrigatório' });
    });
    expect(getByRole('alert').textContent).toContain('Obrigatório');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
