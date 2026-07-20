# Proteção da branch `main` (GitHub)

Proteção real é server-side. Este repositório ainda é local (sem remote), então
os hooks em `.githooks/` fazem o guard local. Ao criar o remote no GitHub, aplique
o ruleset abaixo (via UI ou `gh`):

## Regras exigidas

- Proibir push direto na `main`.
- Exigir Pull Request antes do merge.
- Exigir **1 revisão aprovada**.
- Exigir **status checks** verdes: job `verify` do workflow CI (format, lint,
  typecheck, boundaries, test, build).
- Exigir branch atualizada com a base antes do merge.
- Proibir force-push e deleção da `main`.

## Aplicar via gh CLI (após `git remote add origin <url>` e primeiro push)

```sh
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=verify" \
  -f "enforce_admins=true" \
  -f "required_pull_request_reviews[required_approving_review_count]=1" \
  -f "restrictions="
```
