// Identidade Operacional V1 — Fase 4B. Prova, no nível do container (sem UI),
// a vertical REAL: colaborador cadastrado → PIN → identificação → autoria com
// employeeId real → autorização HONESTA (identidade ≠ autorização). Segurança:
// PIN nunca no EmployeeRecord, na fila, no snapshot nem no lockout.

import { describe, expect, it } from 'vitest';

import { CAPABILITY_TASK_REVIEW, type EffectiveAuthorization } from '@tauros/contracts';

import { buildContainer, type AppContainer } from '../src/wiring/container.js';
import { FIXTURE_STORE } from '../src/wiring/fixtures.js';

const DEVICE = 'device-web-01';

/** Autorização do encarregado DEV (Elber) — via o MESMO OperatorIdentityPort. */
async function elberAuthorization(container: AppContainer): Promise<EffectiveAuthorization> {
  const outcome = await container.identity.verify({
    storeId: FIXTURE_STORE.id,
    employeeId: 'emp-0004',
    pin: '123456',
    deviceId: DEVICE,
  });
  if (outcome.kind !== 'verified') throw new Error('Elber DEV deveria verificar');
  return outcome.authorization;
}

async function registerJoao(
  container: AppContainer,
  auth: EffectiveAuthorization,
  pin: string,
): Promise<string> {
  // o adapter de fila lê a autorização corrente do container (wiring real)
  container.setAuthorization(auth);
  const result = await container.registerEmployee.execute({
    authorization: auth,
    deviceId: DEVICE,
    storeTimeZone: FIXTURE_STORE.timeZone,
    fullName: 'João da Silva',
    startDate: '2026-08-15',
    positionId: 'pos-acougueiro-1',
    teamId: 'team-a',
    shiftDefinitionId: null,
    createdOffline: true,
  });
  if (result.kind !== 'registered') throw new Error(`cadastro falhou: ${JSON.stringify(result)}`);
  await container.credentials.upsert({
    storeId: result.employee.storeId,
    employeeId: result.employee.id,
    pin,
    status: 'LOCAL_PENDING_PROVISIONING',
  });
  return result.employee.id;
}

describe('Fase 4B — cadastro + credencial + identidade real', () => {
  it('1-2. credencial é criada SEPARADA do Employee (Employee sem PIN)', async () => {
    const container = buildContainer({ deviceId: DEVICE });
    await container.reconcileFromQueue(); // semeia baseline (posições/equipes)
    const auth = await elberAuthorization(container);
    const joaoId = await registerJoao(container, auth, '778899');

    const employees = await container.workforce.employees(FIXTURE_STORE.id);
    const joao = employees.find((e) => e.id === joaoId);
    expect(joao).toBeDefined();
    // Employee NÃO carrega PIN nem verifier
    expect(JSON.stringify(joao)).not.toContain('778899');
    expect('pin' in (joao as object)).toBe(false);
    // credencial vive em store DEDICADO e nasce pendente de provisionamento
    const credential = await container.credentials.get(FIXTURE_STORE.id, joaoId);
    expect(credential?.status).toBe('LOCAL_PENDING_PROVISIONING');
    await container.close();
  });

  it('3-4-9. PIN correto identifica João com AUTORIA real; PIN errado falha', async () => {
    const container = buildContainer({ deviceId: DEVICE });
    await container.reconcileFromQueue();
    const auth = await elberAuthorization(container);
    const joaoId = await registerJoao(container, auth, '778899');

    const ok = await container.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: joaoId,
      pin: '778899',
      deviceId: DEVICE,
    });
    expect(ok.kind).toBe('verified');
    if (ok.kind !== 'verified') throw new Error('esperava verified');
    // autoria = employeeId REAL; profileId/membership de plataforma são null
    expect(ok.authorization.operatorEmployeeId).toBe(joaoId);
    expect(ok.authorization.operatorProfileId).toBeNull();
    expect(ok.authorization.membershipId ?? null).toBeNull();
    expect(ok.authorization.sessionId.startsWith('platform:')).toBe(false);

    const bad = await container.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: joaoId,
      pin: '000000',
      deviceId: DEVICE,
    });
    expect(bad.kind).toBe('rejected');
    await container.close();
  });

  it('10-15. IDENTIDADE ≠ AUTORIZAÇÃO: João identificado NÃO tem task.review; Elber tem', async () => {
    const container = buildContainer({ deviceId: DEVICE });
    await container.reconcileFromQueue();
    const auth = await elberAuthorization(container);
    const joaoId = await registerJoao(container, auth, '778899');

    const joao = await container.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: joaoId,
      pin: '778899',
      deviceId: DEVICE,
    });
    if (joao.kind !== 'verified') throw new Error('João deveria verificar');
    // colaborador novo é identificado, mas SEM capability (nada derivado de
    // posição/equipe) — o use case de conferência negaria
    expect(joao.authorization.permissions).not.toContain(CAPABILITY_TASK_REVIEW);
    // Elber (fixture DEV provisionado) mantém a capability oficial
    expect(auth.permissions).toContain(CAPABILITY_TASK_REVIEW);
    await container.close();
  });

  it('5-6. lockout progressivo por (employee×device) e SOBREVIVE à recriação do container', async () => {
    // MemoryLocalStore compartilhado entre "reloads" para provar persistência
    const { MemoryLocalStore } = await import('@tauros/infrastructure');
    const { APP_STATE_SCHEMA } = await import('../src/wiring/adapters.js');
    const appStore = new MemoryLocalStore(APP_STATE_SCHEMA);

    const first = buildContainer({ deviceId: DEVICE, appStore });
    await first.reconcileFromQueue();
    const auth = await elberAuthorization(first);
    const joaoId = await registerJoao(first, auth, '778899');
    // 5 erros (auth.pin.maxAttempts do Baseline) → lockout
    for (let i = 0; i < 5; i += 1) {
      await first.identity.verify({
        storeId: FIXTURE_STORE.id,
        employeeId: joaoId,
        pin: '000000',
        deviceId: DEVICE,
      });
    }
    const locked = await first.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: joaoId,
      pin: '778899', // PIN correto, mas em lockout
      deviceId: DEVICE,
    });
    expect(locked).toMatchObject({ kind: 'rejected', code: 'LOCKED_OUT' });

    // "reload": novo container sobre o MESMO store — o lockout persiste
    const second = buildContainer({ deviceId: DEVICE, appStore });
    const stillLocked = await second.identity.verify({
      storeId: FIXTURE_STORE.id,
      employeeId: joaoId,
      pin: '778899',
      deviceId: DEVICE,
    });
    expect(stillLocked).toMatchObject({ kind: 'rejected', code: 'LOCKED_OUT' });
    await second.close();
  });

  it('12. credencial/verifier nunca entram na fila operacional genérica', async () => {
    const container = buildContainer({ deviceId: DEVICE });
    await container.reconcileFromQueue();
    const auth = await elberAuthorization(container);
    const joaoId = await registerJoao(container, auth, '778899');
    const credential = await container.credentials.get(FIXTURE_STORE.id, joaoId);
    const verifier = credential?.verifier ?? '';

    const queued = await container.queue.all();
    const serialized = JSON.stringify(queued);
    expect(serialized).not.toContain('778899'); // o PIN
    expect(serialized).not.toContain(verifier); // o verifier
    // nenhum item da fila é de credencial
    expect(queued.some((item) => item.entityType.includes('credential'))).toBe(false);
    await container.close();
  });
});
