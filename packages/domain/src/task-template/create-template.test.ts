// Testes de domínio da criação de definição de tarefa — determinísticos.

import { describe, expect, it } from 'vitest';

import { decideCreateTemplate, type CreateTemplateCommand } from './create-template.js';

const FIXED_NOW = new Date('2026-08-13T11:00:00.000Z');

const command: CreateTemplateCommand = {
  templateId: 'tpl-1',
  storeId: 'store-1',
  title: 'Organizar câmara fria',
  frequency: 'ONCE',
  targetPositionId: 'pos-producao',
  requiresPhoto: false,
  expectedMin: null,
  expectedMax: null,
  clientCreatedAt: FIXED_NOW,
  effectiveFrom: '2026-08-13',
  plannedStartMinutes: 9 * 60,
  dueOffsetMinutes: 15 * 60,
  recurrence: { kind: 'ONCE' },
  idempotencyKey: 'task-template-create:store-1:2026-08-13:emp-0004:organizar-camara-fria',
};

describe('decideCreateTemplate', () => {
  it('cria definição válida, ativa, com o título normalizado', () => {
    const decision = decideCreateTemplate({ ...command, title: '  Organizar câmara fria  ' }, null);
    expect(decision.kind).toBe('create');
    if (decision.kind !== 'create') return;
    expect(decision.template.title).toBe('Organizar câmara fria');
    expect(decision.template.active).toBe(true);
    expect(decision.template.targetPositionId).toBe('pos-producao');
    expect(decision.template.idempotencyKey).toBe(command.idempotencyKey);
  });

  it('replay da MESMA criação é idempotente, não erro', () => {
    const decision = decideCreateTemplate(command, 'tpl-ja-criada');
    expect(decision).toEqual({ kind: 'already-created', templateId: 'tpl-ja-criada' });
  });

  it('rejeita título vazio', () => {
    const decision = decideCreateTemplate({ ...command, title: '   ' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'TITLE_REQUIRED' });
  });

  it('rejeita título acima do limite', () => {
    const decision = decideCreateTemplate({ ...command, title: 'x'.repeat(121) }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'TITLE_REQUIRED' });
  });

  it('permite responsável OPCIONAL em ONCE/WEEKDAYS ("definir no dia")', () => {
    const once = decideCreateTemplate({ ...command, targetPositionId: null }, null);
    expect(once.kind).toBe('create');
    if (once.kind === 'create') expect(once.template.targetPositionId).toBeNull();

    const weekdays = decideCreateTemplate(
      { ...command, targetPositionId: '  ', recurrence: { kind: 'WEEKDAYS', weekdays: ['MON'] } },
      null,
    );
    expect(weekdays.kind).toBe('create');
    if (weekdays.kind === 'create') expect(weekdays.template.targetPositionId).toBeNull();
  });

  it('WHEN_SCHEDULED exige posição responsável (não dá para perguntar "escalado?" sem posição)', () => {
    const decision = decideCreateTemplate(
      { ...command, targetPositionId: null, recurrence: { kind: 'WHEN_SCHEDULED' } },
      null,
    );
    expect(decision).toMatchObject({ kind: 'rejected', code: 'ASSIGNMENT_REQUIRED' });
  });

  it('WHEN_SCHEDULED com posição é aceito', () => {
    const decision = decideCreateTemplate(
      { ...command, targetPositionId: 'pos-apoio', recurrence: { kind: 'WHEN_SCHEDULED' } },
      null,
    );
    expect(decision.kind).toBe('create');
  });

  it('WEEKDAYS sem nenhum dia é rejeitado', () => {
    const decision = decideCreateTemplate(
      { ...command, recurrence: { kind: 'WEEKDAYS', weekdays: [] } },
      null,
    );
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_RECURRENCE' });
  });

  it('rejeita data inicial inválida', () => {
    const decision = decideCreateTemplate({ ...command, effectiveFrom: '13/08/2026' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_DATE' });
  });

  it('rejeita fim máximo <= início planejado', () => {
    expect(
      decideCreateTemplate({ ...command, plannedStartMinutes: 600, dueOffsetMinutes: 600 }, null),
    ).toMatchObject({ kind: 'rejected', code: 'INVALID_TIME_RANGE' });
    expect(
      decideCreateTemplate({ ...command, plannedStartMinutes: 600, dueOffsetMinutes: 540 }, null),
    ).toMatchObject({ kind: 'rejected', code: 'INVALID_TIME_RANGE' });
  });

  it('rejeita horários fora do dia operacional', () => {
    expect(decideCreateTemplate({ ...command, plannedStartMinutes: -1 }, null)).toMatchObject({
      kind: 'rejected',
      code: 'INVALID_DUE_TIME',
    });
    expect(decideCreateTemplate({ ...command, dueOffsetMinutes: 24 * 60 }, null)).toMatchObject({
      kind: 'rejected',
      code: 'INVALID_DUE_TIME',
    });
    expect(decideCreateTemplate({ ...command, dueOffsetMinutes: 10.5 }, null)).toMatchObject({
      kind: 'rejected',
      code: 'INVALID_DUE_TIME',
    });
  });

  it('rejeita faixa esperada invertida', () => {
    const decision = decideCreateTemplate({ ...command, expectedMin: 5, expectedMax: 2 }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_RANGE' });
  });

  it('aceita faixa esperada coerente', () => {
    const decision = decideCreateTemplate({ ...command, expectedMin: -2, expectedMax: 4 }, null);
    expect(decision.kind).toBe('create');
  });

  it('rejeita comando incompleto', () => {
    const decision = decideCreateTemplate({ ...command, storeId: '' }, null);
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });

  it('rejeita horário de criação inválido', () => {
    const decision = decideCreateTemplate(
      { ...command, clientCreatedAt: new Date('não é data') },
      null,
    );
    expect(decision).toMatchObject({ kind: 'rejected', code: 'INVALID_COMMAND' });
  });

  it('é determinística: mesma entrada, mesma decisão', () => {
    expect(decideCreateTemplate(command, null)).toEqual(decideCreateTemplate(command, null));
  });
});
