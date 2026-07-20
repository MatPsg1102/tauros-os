// Suíte de CONTRATO do LocalStorePort (§1) — reutilizada por MemoryLocalStore
// e IndexedDbLocalStore. Comprova que ambos os adapters respeitam o mesmo
// comportamento observável; diferenças deliberadas são parametrizadas.

import { describe, expect, it } from 'vitest';

import type { LocalSchema, LocalStorePort } from './local-store.js';

export interface ContractContext {
  /** Cria um store NOVO (banco vazio) para o schema dado. */
  createStore(schema: LocalSchema): Promise<LocalStorePort>;
  /** "Reabre" o mesmo banco (close + nova instância). */
  reopen(previous: LocalStorePort, schema: LocalSchema): Promise<LocalStorePort>;
  /**
   * Diferença deliberada: memória é process-lifetime (reabrir = vazio);
   * IndexedDB é durável (reabrir preserva os dados).
   */
  readonly durableAcrossReopen: boolean;
  /** Gera um nome de banco único por teste (isolamento). */
  uniqueName(): string;
}

const baseSchema = (name: string): LocalSchema => ({
  databaseName: name,
  version: 1,
  migrations: [
    {
      toVersion: 1,
      description: 'stores base do contrato',
      stores: [{ name: 'items', indexes: { by_kind: 'kind' } }, { name: 'meta' }],
    },
  ],
});

export function localStoreContract(label: string, ctx: ContractContext): void {
  describe(`contrato LocalStorePort — ${label}`, () => {
    it('abre, inicializa o schema e aceita leitura/escrita básica', async () => {
      const store = await ctx.createStore(baseSchema(ctx.uniqueName()));
      await store.transaction(['items'], 'write', async (tx) => {
        await tx.put('items', 'k1', { id: 'k1', kind: 'a', value: 1 });
      });
      const loaded = await store.transaction(['items'], 'read', (tx) => tx.get('items', 'k1'));
      expect(loaded).toEqual({ id: 'k1', kind: 'a', value: 1 });
      await store.close();
    });

    it('atualiza e remove valores', async () => {
      const store = await ctx.createStore(baseSchema(ctx.uniqueName()));
      await store.transaction(['items'], 'write', async (tx) => {
        await tx.put('items', 'k', { id: 'k', kind: 'a', value: 1 });
        await tx.put('items', 'k', { id: 'k', kind: 'a', value: 2 });
      });
      expect(
        await store.transaction(['items'], 'read', (tx) => tx.get('items', 'k')),
      ).toMatchObject({ value: 2 });
      await store.transaction(['items'], 'write', (tx) => tx.delete('items', 'k'));
      expect(
        await store.transaction(['items'], 'read', (tx) => tx.get('items', 'k')),
      ).toBeUndefined();
      await store.close();
    });

    it('consulta por índice (keyPath)', async () => {
      const store = await ctx.createStore(baseSchema(ctx.uniqueName()));
      await store.transaction(['items'], 'write', async (tx) => {
        await tx.put('items', '1', { id: '1', kind: 'x' });
        await tx.put('items', '2', { id: '2', kind: 'y' });
        await tx.put('items', '3', { id: '3', kind: 'x' });
      });
      const xs = await store.transaction(['items'], 'read', (tx) =>
        tx.getByIndex('items', 'by_kind', 'x'),
      );
      expect(xs.map((v) => (v as { id: string }).id).sort()).toEqual(['1', '3']);
      await store.close();
    });

    it('transação com falha faz rollback total (atomicidade)', async () => {
      const store = await ctx.createStore(baseSchema(ctx.uniqueName()));
      await store.transaction(['items'], 'write', (tx) =>
        tx.put('items', 'keep', { id: 'keep', kind: 'a' }),
      );
      await expect(
        store.transaction(['items'], 'write', async (tx) => {
          await tx.put('items', 'ghost', { id: 'ghost', kind: 'b' });
          await tx.delete('items', 'keep');
          throw new Error('boom');
        }),
      ).rejects.toThrow();
      const all = await store.transaction(['items'], 'read', (tx) => tx.getAll('items'));
      expect(all.map((v) => (v as { id: string }).id)).toEqual(['keep']);
      await store.close();
    });

    it('persiste entre reaberturas conforme a durabilidade do adapter', async () => {
      const schema = baseSchema(ctx.uniqueName());
      const first = await ctx.createStore(schema);
      await first.transaction(['items'], 'write', (tx) =>
        tx.put('items', 'p', { id: 'p', kind: 'persist' }),
      );
      const second = await ctx.reopen(first, schema);
      const loaded = await second.transaction(['items'], 'read', (tx) => tx.get('items', 'p'));
      if (ctx.durableAcrossReopen) {
        expect(loaded).toMatchObject({ id: 'p' });
      } else {
        expect(loaded).toBeUndefined();
      }
      await second.close();
    });

    it('migra de versão antiga preservando dados (incremental, sem re-execução)', async () => {
      const name = ctx.uniqueName();
      let v1Upgrades = 0;
      const v1: LocalSchema = {
        databaseName: name,
        version: 1,
        migrations: [
          {
            toVersion: 1,
            description: 'v1',
            stores: [{ name: 'items' }],
            onUpgrade: () => {
              v1Upgrades += 1;
            },
          },
        ],
      };
      const storeV1 = await ctx.createStore(v1);
      await storeV1.transaction(['items'], 'write', (tx) => tx.put('items', 'old', { id: 'old' }));

      const v2: LocalSchema = {
        databaseName: name,
        version: 2,
        migrations: [
          ...v1.migrations,
          { toVersion: 2, description: 'v2 adiciona store', stores: [{ name: 'extra' }] },
        ],
      };
      const storeV2 = await ctx.reopen(storeV1, v2);
      // store novo existe e é utilizável
      await storeV2.transaction(['extra'], 'write', (tx) => tx.put('extra', 'e', { id: 'e' }));
      if (ctx.durableAcrossReopen) {
        // dados antigos preservados e migration v1 NÃO reexecutada na reabertura
        const old = await storeV2.transaction(['items'], 'read', (tx) => tx.get('items', 'old'));
        expect(old).toMatchObject({ id: 'old' });
        expect(v1Upgrades).toBe(1);
      }
      await storeV2.close();
    });

    it('migration que falha não deixa o banco parcialmente atualizado', async () => {
      const name = ctx.uniqueName();
      const v1 = baseSchema(name);
      const storeV1 = await ctx.createStore(v1);
      await storeV1.transaction(['items'], 'write', (tx) =>
        tx.put('items', 'safe', { id: 'safe', kind: 'a' }),
      );

      const broken: LocalSchema = {
        databaseName: name,
        version: 2,
        migrations: [
          ...v1.migrations,
          {
            toVersion: 2,
            description: 'migration defeituosa',
            stores: [{ name: 'should_not_exist' }],
            onUpgrade: () => {
              throw new Error('migration falhou');
            },
          },
        ],
      };
      await expect(ctx.reopen(storeV1, broken)).rejects.toThrow();

      if (ctx.durableAcrossReopen) {
        // Banco permanece na v1, íntegro e utilizável.
        const reopened = await ctx.createStore(v1);
        const safe = await reopened.transaction(['items'], 'read', (tx) => tx.get('items', 'safe'));
        expect(safe).toMatchObject({ id: 'safe' });
        await expect(
          reopened.transaction(['should_not_exist'], 'read', (tx) => tx.getAll('should_not_exist')),
        ).rejects.toThrow();
        await reopened.close();
      }
    });

    it('escrita em transação read-only é recusada', async () => {
      const store = await ctx.createStore(baseSchema(ctx.uniqueName()));
      await expect(
        store.transaction(['items'], 'read', (tx) => tx.put('items', 'x', { id: 'x' })),
      ).rejects.toThrow();
      await store.close();
    });

    it('limpeza segura: delete de chave específica não afeta vizinhos', async () => {
      const store = await ctx.createStore(baseSchema(ctx.uniqueName()));
      await store.transaction(['items'], 'write', async (tx) => {
        await tx.put('items', 'a', { id: 'a', kind: 'k' });
        await tx.put('items', 'b', { id: 'b', kind: 'k' });
      });
      await store.transaction(['items'], 'write', (tx) => tx.delete('items', 'a'));
      const rest = await store.transaction(['items'], 'read', (tx) => tx.getAll('items'));
      expect(rest.map((v) => (v as { id: string }).id)).toEqual(['b']);
      await store.close();
    });
  });
}
