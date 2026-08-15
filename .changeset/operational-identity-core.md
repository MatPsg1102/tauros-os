---
'@tauros/contracts': minor
'@tauros/domain': minor
'@tauros/application': minor
'@tauros/infrastructure': minor
---

Identidade Operacional V1 — Fase 4A (contratos + schema + domínio/adapters, SEM UI). Materializa a infraestrutura mínima da ADR-021: Employee como ator, credencial de PIN separada e autoridade final do servidor.

- contracts: novo módulo `identity/` — `OperatorIdentityPort` (verify por `employeeId`+PIN; `employeeId` identifica, PIN verifica), `OperationalCredentialPort`, `PinLockoutStorePort`, `CredentialProvisioningPort` (fronteira futura), `PinPolicy(Port)` e records `OperationalCredentialRecord`/`PinLockoutState`. `EffectiveAuthorization.operatorProfileId`/`membershipId` opcionais/null; audit inputs ganham `actorEmployeeId` (autoria obrigatória) e `actorProfileId` nullable. Sem UUID fictício de plataforma.
- domain: sessão e execução aceitam `actorProfileId`/`performedByProfileId`/`reviewedByProfileId` null (identidade de plataforma opcional); autoria obrigatória migrou para `*EmployeeId`.
- application: audit de todos os use cases passa a registrar `actorEmployeeId`.
- infrastructure: `Pbkdf2PinHasher` (WebCrypto PBKDF2-SHA256 — fallback autorizado pelo Baseline, sem dependência WASM nova); snapshot `FORBIDDEN_FIELD_PATTERN` passa a barrar `verifier|salt|hash`; codec/snapshot aceitam `operatorProfileId` null; `actorId` de auditoria = `profileId ?? employeeId`.
- schema: migration Prisma aditiva `employee_pin_credentials` (1:0..1; `employees` intacta) + `operator_sessions.actor_profile_id` nullable; RLS Supabase (verifier só server-side, nunca bearer credential).
