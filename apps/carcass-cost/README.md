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

## Decisões de domínio (modelo v2)

- **Três conceitos separados na estimativa**:
  - **Quebra de abate** (física, padrão 17%): sobre o peso VIVO.
  - **Quebra de frio** (física, padrão 2,5%): sobre o peso que restou APÓS o
    abate — nunca sobre o vivo. Sequencial: 17% + 2,5% ⇒ rendimento 80,925%
    (0,83 × 0,975), não 80,5%.
  - **Ajuste comercial/exportação** (econômico, padrão 7%): compara a carcaça
    recebida com a referência de exportação (mãozinha, rabinho, banha etc.).
    Incide SÓ sobre o custo da matéria-prima convertido — nunca sobre
    abate/serviço/frete e nunca sobre o rendimento físico.
- **Cadeia econômica da estimativa**:
  `base = vivo ÷ (1 − q_abate) ÷ (1 − q_frio)`;
  `equivalente = base × (1 + ajuste)`;
  `custo final = equivalente + (abate + serviço + frete) ÷ peso final`.
- **Peso vivo médio**: na estimativa o usuário informa nº de suínos + peso
  vivo MÉDIO por suíno; o total (animais × médio) é derivado e exibido, nunca
  digitado.
- **O custo final headline inclui TODOS os custos** com a composição por kg
  exibida logo abaixo — nenhum custo escondido.
- **Custos adicionais** (nunca recebem o ajuste comercial): taxa de abate
  (R$/cabeça × quantidade), taxa de serviço (R$/suíno × quantidade) e o custo
  da VIAGEM = diária do motorista + combustível (uma única vez por lote,
  nunca por cabeça). `custo_adicional_por_kg = total ÷ peso FINAL da carcaça`.
- Modo Lote Real: custo físico real (sem ajuste comercial); peso pago =
  balança − descontos; % quebra de abate sobre o peso pago; % quebra de frio
  sobre o peso abatido; custo/kg = custo total ÷ peso após frio.

## Vetores de teste canônicos

- Física da estimativa: 100 suínos × 115 kg = 11.500 kg → ×0,83 = 9.545 kg →
  ×0,975 = **9.306,375 kg** (rendimento 80,925%).
- Econômica da estimativa: vivo R$ 5,20 ⇒ 5,20 ÷ 0,83 ÷ 0,975 × 1,07 ≈
  **R$ 6,88/kg** (antes de abate/serviço/frete, rateados pelo peso final).
- Custos da estimativa (caso realista): 100 suínos, abate R$ 50/cabeça +
  serviço R$ 3 + diária R$ 150 + combustível R$ 250 = R$ 5.700 ÷ 9.306,375 kg
  = R$ 0,6125/kg ⇒ final 6,8755 + 0,6125 ≈ **R$ 7,49/kg**.
- Lote real: 110 suínos, balança 12.560 kg, graxaria 220 kg, abatido
  10.513,50 kg, após frio 10.217,20 kg, vivo R$ 4,80, abate R$ 50/cabeça,
  serviço R$ 3, diária R$ 150 + combustível R$ 0 ⇒ total R$ 65.212,00 ⇒
  **R$ 6,38/kg**.

## Fora de escopo (deliberado)

Login, backend, sincronização, gráficos, integração com ERP/fiscal. O app é
isolado: consome apenas `@tauros/tokens`, `@tauros/theme` e
`@tauros/ui-primitives`, e nada no monorepo depende dele.
