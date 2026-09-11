# @tauros/carcass-cost — Custo da Carcaça

Calculadora operacional, mobile-first e offline, do **custo real do suíno vivo
transformado em carcaça** ("se eu comprar esse suíno por esse preço, quanto vai
custar cada kg de carcaça que chega ao frigorífico?"). Não é ERP nem dashboard:
uma tela de decisão, uma de configurações e um histórico simples.

## Como rodar

```bash
pnpm --filter @tauros/carcass-cost dev      # http://localhost:3010
pnpm --filter @tauros/carcass-cost test     # fórmulas, validação, jornada, axe
pnpm --filter @tauros/carcass-cost build    # SPA estática em dist/ (PWA)
```

## Arquitetura

- **`src/domain/`** — fonte de verdade matemática, TypeScript puro sem React.
  `calculateQuickEstimate` (modo Estimativa), `calculateRealLot` (modo Lote
  Real), `whatIfPrices` (comparação de preço) e a validação (`validation.ts`).
  Nenhuma fórmula vive na UI; nada é arredondado internamente (apresentação em
  2 casas só em `ui/format.ts`).
- **`src/state/`** — estado + persistência: `use-calculator.ts` (controller,
  padrão dos controllers do apps/web) e `storage.ts` (localStorage com envelope
  versionado e saneamento defensivo; chaves `tauros.carcass-cost.state.v1` e
  `tauros.carcass-cost.history.v1`).
- **`src/ui/`** — telas compostas exclusivamente com `@tauros/ui-primitives`
  (barrel público) + tokens via `cssVar`. Sem stylesheet paralelo.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` (precache do casco;
  network-first para navegação, cache-first para assets com hash). O service
  worker só registra em produção.

## Decisões de domínio

- **Quebras são sequenciais**, nunca somadas: 20% de abate + 7% de frio ⇒
  rendimento final 74,40% (0,80 × 0,93), não 73%.
- **"Quebra de frio" ≠ "transformação"**: a quebra de frio é perda física (só
  afeta peso); a transformação é acréscimo econômico do modo rápido (só afeta
  preço: `vivo ÷ (1 − quebra abate) × (1 + transformação)`). O campo único
  "Quebra de frio / transformação" alimenta os dois conceitos — separados no
  domínio e documentados na própria tela.
- **O custo final headline inclui TODOS os custos** (animal + abate + serviço +
  frete), com a composição por kg exibida logo abaixo — nenhum custo escondido.
- **Taxa de abate**: um modelo por vez — R$/kg (sobre o peso final) ou
  R$/cabeça — nunca os dois.
- Modo Lote Real: peso pago = balança − descontos; % quebra de abate sobre o
  peso pago; % quebra de frio sobre o peso abatido; custo/kg = custo total ÷
  peso após frio.

## Vetores de teste canônicos (do spec do produto)

- Estimativa: vivo R$ 5,00, quebra 20%, transformação 7%, abate R$ 0,50/kg ⇒
  **R$ 7,1875/kg** (exibe R$ 7,19; com serviço/frete padrão ⇒ R$ 7,24).
- Lote real: 110 suínos, balança 12.560 kg, graxaria 220 kg, abatido
  10.513,50 kg, após frio 10.217,20 kg, vivo R$ 4,80, abate R$ 50/cabeça,
  serviço R$ 3, frete R$ 150 ⇒ total R$ 65.212,00 ⇒ **R$ 6,38/kg**.

## Fora de escopo (deliberado)

Login, backend, sincronização, gráficos, integração com ERP/fiscal. O app é
isolado: consome apenas `@tauros/tokens`, `@tauros/theme` e
`@tauros/ui-primitives`, e nada no monorepo depende dele.
