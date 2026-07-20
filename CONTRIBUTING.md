# Contribuindo — Tauros OS

Fluxo de produção (mesmo trabalhando sozinho):

1. Nunca commitar/push direto na `main`. Crie um branch: `git checkout -b <tipo>/<escopo>`.
2. Commits seguem **Conventional Commits** (validado pelo hook `commit-msg`).
3. Toda mudança entra por **Pull Request** com **CI verde** e **revisão** (regras no GitHub — ver `docs/branch-protection.md`).
4. Hooks locais são ativados automaticamente por `pnpm install` (`prepare` → `core.hooksPath=.githooks`):
   - `pre-commit`: `format:check` + `boundaries`;
   - `commit-msg`: Conventional Commits;
   - `pre-push`: bloqueia push direto na `main`.

Padrões de código: ver `docs/adr/ADR-018A-implementation-conventions.md`.
