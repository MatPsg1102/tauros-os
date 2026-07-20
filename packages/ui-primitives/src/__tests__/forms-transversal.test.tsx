// Transversais dos Form Components (6.3.4): sem efeito colateral no import,
// injeção endurecida, SSR, modos de tema, disciplina de tokens.

import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFERENCES, ThemeProvider } from '@tauros/theme';

import {
  Checkbox,
  CurrencyInput,
  DatePicker,
  Field,
  IncompatibleStylesElementError,
  injectUiStyles,
  Input,
  MultiSelect,
  NumberInput,
  PinInput,
  Radio,
  RadioGroup,
  SearchInput,
  Select,
  Switch,
  taurosUiStyles,
  TextArea,
  TimePicker,
} from '../index.js';

function allForms(): ReactElement {
  return (
    <div>
      <Field label="Nome" description="d" error="e" required>
        <Input />
      </Field>
      <TextArea aria-label="Obs" />
      <NumberInput aria-label="Qtde" />
      <CurrencyInput aria-label="Preço" />
      <SearchInput aria-label="Buscar" />
      <Select aria-label="Cat">
        <option value="a">A</option>
      </Select>
      <MultiSelect aria-label="Multi" options={[{ value: 'a', label: 'A' }]} />
      <Checkbox label="C" />
      <RadioGroup label="G">
        <Radio value="1" label="Um" />
      </RadioGroup>
      <Switch label="S" />
      <DatePicker aria-label="Data" />
      <TimePicker aria-label="Hora" />
      <PinInput length={4} label="PIN" />
    </div>
  );
}

describe('efeitos colaterais', () => {
  it('importar componentes NÃO injeta CSS no DOM', () => {
    // este arquivo importa toda a API; nenhuma folha pode existir antes do inject
    expect(document.getElementById('tauros-ui-styles')).toBeNull();
  });

  it('injectUiStyles: idempotente, atualiza conteúdo próprio, rejeita elemento alheio', () => {
    injectUiStyles(document);
    const el = document.getElementById('tauros-ui-styles') as HTMLStyleElement;
    expect(el.hasAttribute('data-tauros-ui-styles')).toBe(true);

    el.textContent = 'versao-antiga';
    injectUiStyles(document);
    expect(el.textContent).toBe(taurosUiStyles);

    el.remove();
    const alien = document.createElement('style');
    alien.id = 'tauros-ui-styles';
    document.head.appendChild(alien);
    expect(() => injectUiStyles(document)).toThrow(IncompatibleStylesElementError);
    alien.remove();
  });
});

describe('renderização e SSR', () => {
  it('todos os 14 form components renderizam sob ThemeProvider', () => {
    const { container } = render(<ThemeProvider>{allForms()}</ThemeProvider>);
    expect(container.querySelectorAll('.t-frame').length).toBeGreaterThanOrEqual(8);
  });

  it('SSR determinístico (IDs estáveis) para a composição completa', () => {
    const ui = <ThemeProvider>{allForms()}</ThemeProvider>;
    expect(renderToString(ui)).toBe(renderToString(ui));
  });
});

describe('modos de runtime (rebinding de variáveis, sem condicionais React)', () => {
  it.each([
    ['dark', { colorScheme: 'dark' as const }],
    ['highContrast', { modes: { ...DEFAULT_PREFERENCES.modes, highContrast: true } }],
    ['glove', { modes: { ...DEFAULT_PREFERENCES.modes, glove: true } }],
    ['reducedMotion', { modes: { ...DEFAULT_PREFERENCES.modes, reducedMotion: true } }],
  ])('renderiza sob modo %s', (_name, patch) => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const { container } = render(
      <ThemeProvider defaultPreferences={{ ...DEFAULT_PREFERENCES, ...patch }} target={target}>
        {allForms()}
      </ThemeProvider>,
    );
    expect(container.querySelector('.t-frame')).not.toBeNull();
    target.remove();
  });
});

describe('disciplina de tokens', () => {
  it('CSS dos formulários referencia apenas variáveis --tauros (sem cores literais)', () => {
    expect(taurosUiStyles).toContain('.t-frame');
    expect(taurosUiStyles).toContain('.t-switch-input');
    expect(taurosUiStyles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(taurosUiStyles).not.toMatch(/\brgba?\(/);
  });
});
