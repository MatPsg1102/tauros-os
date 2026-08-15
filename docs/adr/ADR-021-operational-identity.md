# ADR-021 — Identidade Operacional: Employee como ator, credencial PIN separada e autoridade final do servidor

- **Status:** Accepted
- **Data:** 2026-08-15
- **Relaciona-se com:** ADR-014 (sessão de operador), ADR-015/016/017 (sessão), **ADR-018 (permissões efetivas)**, ADR-018A (convenções), ADR-019 (Configuration Engine), Configuration Baseline v1.0 §3 (PIN offline), SAS, RA-QUEUE-01.

## Contexto

A Operação Compartilhada V1 (PR #30) introduziu identificação por PIN just-in-time na `/operacao`. Hoje essa identificação é uma **fixture de desenvolvimento** (`FIXTURE_OPERATORS`, `identifyByPin`): quatro operadores estáticos com PIN em código e permissões hardcoded. O cadastro real de colaboradores (Gestão de Equipe V1) produz `Employee` que — por documentação explícita — **não é identidade autenticável**: quem se cadastra pela UI não recebe PIN nem permissões e não consegue operar. Existe uma ponte fictícia entre PIN e `employeeId` que precisa desaparecer antes do piloto.

Esta ADR **não re-arquiteta** autorização: ADR-018 permanece autoridade. Ela decide a camada que faltava — **autenticação operacional** — e como ela se liga à autoria, à sessão e à auditoria já existentes.

## Problema

Precisamos que o colaborador cadastrado seja a mesma identidade que informa PIN, assume tarefa, executa, finaliza e (quando autorizado) confere — com autoria e auditoria reais — **sem** criar um sistema paralelo de autenticação, sem PIN em texto puro, sem prometer segurança criptográfica que um PIN curto não oferece, e sem inventar backend/sincronização que ainda não existe.

## Decisão

### 1. Identidade

- **Employee** é a identidade operacional de uma pessoa dentro da operação. **`employeeId` é o identificador obrigatório de autoria operacional** em toda ação, execução, evidência, sessão e auditoria.
- **Profile** é identidade de plataforma (espelho do auth provider) e **Membership** é o vínculo de autorização server-side por loja — **existem somente quando provisionados**.
- Portanto: `employeeId` obrigatório; `profileId` e `membershipId` **opcionais** até o provisionamento real. **É proibido gerar UUID fictício** para Profile/Membership (nada de `platform:<fakeProfileId>`).

### 2. UX de identificação

Fluxo oficial: ação crítica → **selecionar colaborador** → informar PIN → **verificar o PIN daquele `employeeId`** → resolver autorização (ADR-018) → executar. **`employeeId` identifica; PIN verifica.** O PIN **não precisa ser globalmente único** na loja: a verificação é 1:1 contra o verifier do colaborador selecionado.

### 3. Credencial

`OperationalCredential` é conceito **separado** de `Employee`. É **proibido** `employee.pin` / `employee.password`. A credencial contém conceitualmente: `employeeId`, `salt`, `verifier` (hash), `algorithm`/parâmetros, `status`, `lastOnlineConfirmedAt`, `updatedAt`. **Nunca** armazena PIN em texto puro. Relação **1:0..1** com Employee — Employee permanece inalterado.

### 4. Política de PIN

Todo valor numérico vem do **Configuration Baseline** (nenhum número nesta ADR): comprimento (`auth.pin.length`), algoritmo e fallback (`auth.pin.hashAlgo`, `auth.pin.kdfIterations`), validade offline (`auth.pin.offlineValidityMs`), tentativas (`auth.pin.maxAttempts`), lockout progressivo (`auth.pin.lockoutStepsMs`), hard reauth (`auth.pin.hardReauthAfter`), PIN ao retomar bloqueio (`session.requirePinOnResume`). **A ADR define responsabilidade; o Baseline define valores.** A UI lê o comprimento do Config Engine — nunca hardcoda dígitos.

### 5. Online — servidor é autoridade final

`employeeId + PIN` → canal TLS → RPC de identidade → o **servidor** verifica o PIN contra o hash armazenado, resolve membership/permissões efetivas e `permission_model_version`, e retorna a `EffectiveAuthorization`. **O cliente nunca envia verifier/hash para autenticar.** É proibido qualquer protocolo em que o hash enviado pelo cliente seja comparado por igualdade e conceda acesso — **o hash não funciona como bearer credential**.

### 6. Offline — verificação local dentro da política

A verificação local só é permitida quando, cumulativamente: existe credencial local válida; a janela `auth.pin.offlineValidityMs` (desde `lastOnlineConfirmedAt`) está válida; existe `AuthorizationSnapshot` válido; `permission_model_version` é compatível; o lockout permite tentativa. Resultado: `EffectiveAuthorization` com `origin = 'offline-snapshot'`. **Autenticação local nunca substitui a autoridade do servidor** — toda ação é revalidada no sync (mecanismo de fila já existente).

### 7. Credencial criada offline

Se colaborador e PIN forem configurados offline, a credencial nasce com status **`LOCAL_PENDING_PROVISIONING`**. Ela funciona **apenas no dispositivo** que possui Employee + credential + contexto de autorização válido. Isso **não** significa existência global. Outro tablet sem sync **não a reconhece** (falha honesta "aguardando sincronização"). Após conexão: provisionamento oficial → servidor cria/atualiza o verifier autorizado → cliente recebe confirmação → estado passa a provisionado. **Não há peer-to-peer.**

### 8. Canal de provisionamento (regra nova)

**Material de credencial não trafega pela fila operacional genérica** (DailyTask/workforce). Introduz-se contrato próprio: **`OperationalCredentialPort`** (verificação/gestão local) e **`CredentialProvisioningPort`** (sincronização/provisionamento), inicialmente com adapter local/fake, futuramente server-side. É **proibido** material de credencial (PIN, salt, verifier, hash) em: `AuthorizationSnapshot`, payload de auditoria, payload da fila operacional genérica, logs e URLs.

### 9. Auditoria

Autoria: **`actorEmployeeId` obrigatório**, `actorProfileId` opcional (registrar ambos quando Profile existir). Eventos de identidade podem registrar `employeeId`, `deviceId`, `storeId`, resultado e timestamp — **nunca** PIN/salt/verifier/hash. Mantém-se o `FORBIDDEN_FIELD_PATTERN` do snapshot e o audit sanitizer como rede de proteção.

### 10. OperatorSession

A sessão passa a representar `actorEmployeeId` obrigatório e `actorProfileId` opcional. **Proibido `platform:<fakeProfileId>`.** Quando um `sessionId` local for necessário, usa-se a identidade própria da sessão (o `id` UUID já gerado no cliente), não um profile fabricado. **Profile é enriquecimento da identidade, não requisito para autoria local.**

### 11. Lockout

Estado **local por `employeeId × deviceId`**, persistente entre reloads (IndexedDB, app-state — **fora da fila**), sem conter PIN, usando exclusivamente valores do Baseline. Tentativa falha → contador → lockout progressivo → auditoria sanitizada. Hard reauth → exige confirmação online. **Lockout local não substitui rate-limit server-side** (que virá com o backend).

### 12. Capabilities

**PIN autentica identidade; PIN não concede permissão.** Após a identificação, o PermissionResolver / authorization snapshot continua decidindo capabilities. Função, posição, equipe e PIN **não** concedem autorização automaticamente. **ADR-018 permanece autoridade de autorização.**

## Modelo

```
Employee (identidade operacional; autoria = employeeId, sempre presente)
  ├─ 1:0..1 OperationalCredential   (salt, verifier, algo/params, status, lastOnlineConfirmedAt)
  ├─ 0..1   Profile                 (só quando provisionado no servidor)
  │            └─ 0..n Membership → roles/overrides → permissões efetivas (ADR-018)
  └─ contribui  AuthorizationSnapshot (employeeId sempre; profileId/membershipId nulos até existirem;
                                       permissions + permission_model_version + validade + origin)

PinLockoutState (local, por employeeId×deviceId; nunca sincronizado, nunca contém material de PIN)
```

## Fluxo online

1. Ação crítica → lista de colaboradores ativos (diretório local).
2. Seleciona colaborador → digita PIN (comprimento de `auth.pin.length`).
3. Cliente checa lockout local; bloqueado → mensagem neutra com tempo restante.
4. `OperatorIdentityPort.verify(employeeId, pin)` → adapter online chama a RPC via TLS.
5. Servidor verifica PIN contra o hash, resolve permissões efetivas + `permission_model_version`.
6. Resposta monta `EffectiveAuthorization` (`origin: 'online'`).
7. Cliente atualiza credencial local + snapshot + `lastOnlineConfirmedAt`; zera lockout.
8. PIN descartado da memória.
9. Use case revalida capability e executa; autoria = `employeeId`; item enfileirado com snapshot.
10. No sync, o servidor revalida (autoridade final — inalterado).

## Fluxo offline

1. Ação crítica → seleção de colaborador + PIN.
2. Checa lockout local (contadores + escada `auth.pin.lockoutStepsMs`).
3. Deriva verifier com salt local e compara com a credencial.
4. Falha → contador++, audit `auth.login.failure` (sem PIN), lockout progressivo; total ≥ `auth.pin.hardReauthAfter` → exige online.
5. Sucesso → valida janela `auth.pin.offlineValidityMs` e `permission_model_version`; inválidos → exige online.
6. Monta `EffectiveAuthorization` (`origin: 'offline-snapshot'`) a partir do último snapshot conhecido.
7. PIN descartado; use case revalida capability contra o snapshot.
8. Ação executa; item enfileirado com `captureSnapshot`.
9. Auditoria no outbox local.
10. Sync → servidor revalida; rejeição → item vai a revisão (fluxo existente).

## Provisionamento

Credencial offline nasce `LOCAL_PENDING_PROVISIONING`, útil só no dispositivo de origem. Na conexão, `CredentialProvisioningPort` promove a credencial ao servidor, que passa a ser a fonte do verifier; o cliente marca a credencial como provisionada. Nenhum material de credencial atravessa a fila operacional genérica.

## Segurança (threat model honesto)

**Objetivo real:** proteger contra **uso oportunista/indevido** por terceiros no ambiente operacional compartilhado (tablet no chão de loja). **Declarado explicitamente: um PIN curto NÃO resiste à análise forense completa de um dispositivo comprometido** — com o verifier em mãos, o espaço do PIN é enumerável offline mesmo sob argon2id. **Não prometemos resistência equivalente a senha forte.** Mitigações: KDF com salt individual, lockout progressivo, janela offline limitada, revogação/`credential-reset`, revalidação no servidor e segurança do dispositivo. Invariantes: verifier nunca transmitido; hash nunca é bearer; PIN/salt/verifier/hash nunca em snapshot/audit/fila/log/URL.

## Consequências

- Novo contrato `OperatorIdentityPort` (verify) — controllers deixam de importar fixtures diretamente.
- Novos `OperationalCredentialPort` e `CredentialProvisioningPort` com adapters local/fake agora, server-side depois.
- Contratos passam a tratar `profileId`/`membershipId` como opcionais; audit inputs ganham `actorEmployeeId` obrigatório.
- **Schema (autorizado conceitualmente, migration na Fase 4):** tabela aditiva `employee_pin_credentials` (1:0..1 com `employees`, `employees` inalterada) e relaxamento de `operator_sessions.actor_profile_id` para NULL. Forward-only.
- OperatorSession reconciliada: `actorEmployeeId` obrigatório, `actorProfileId` nulo até provisionar, sem sessionId sintético.
- Auditoria: autoria por `actorEmployeeId`; `actorProfileId` quando existir.

## Trade-offs

- Verificação offline aceita risco forense conhecido em troca de operar sem backend no piloto.
- Membership local ausente significa que permissões offline vêm do último snapshot — desatualização é possível e resolvida no sync (rejeição → revisão), não localmente.
- Selecionar colaborador antes do PIN adiciona um toque, mas elimina unicidade global de PIN e a busca PIN→Employee.

## Compatibilidade

As fixtures atuais (PIN `1234` etc.) permanecem **apenas DEV** e deverão implementar o **mesmo `OperatorIdentityPort`** como adapter alternativo, garantindo transição sem regressão. Após a implementação, **nenhum controller pode depender diretamente de `fixtures.ts`**.

## Itens adiados (fora desta ADR)

UI final de reset de PIN; recuperação remota; biometria; MFA; SSO; integração definitiva com Supabase Auth; política de dispositivos corporativos; provisionamento enterprise; qualquer gamificação.

## Regra de mudança

Se a implementação revelar necessidade de mudança estrutural, **interromper**, explicar, apresentar alternativas, recomendar e aguardar aprovação antes de alterar qualquer artefato congelado.
