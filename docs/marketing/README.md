# Marketing — Tauros OS

Base de marketing para comercializar o **Tauros OS**
(`github.com/JulioVianaDev/taurus`, SaaS multi-tenant) com outros açougues.
Iniciado em 2026-10-28. Este monorepo (`TaurosSoftware`) é o MVP legado cujas
regras foram migradas para o `taurus` (`docs/legacy-migration.md` lá); os
documentos daqui podem ser movidos para `taurus/docs/marketing/`.

**Escopo de lançamento (decisão de 2026-10-28):** vender **Operação (com
Equipe e escala), Produção, Etiquetas, Custo da carcaça suína e Relatórios
no WhatsApp**. Estoque, Financeiro e o que depende deles (compra por foto,
importação de vendas, DRE, IA) **não são anunciados como feature** até
estarem 100%.

| Documento                                            | Conteúdo                                                                                                                                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-posicionamento.md](01-posicionamento.md)         | Escopo anunciado × não anunciado, diagnóstico da landing, ICP, personas, pilares, diferenciação, impacto nos planos, objeções, riscos                                                    |
| [02-plano-go-to-market.md](02-plano-go-to-market.md) | Três movimentos, portas de entrada, canais, funil com "trial ativado", plano de 90 dias, pedidos ao produto                                                                              |
| [03-landing-e-scripts.md](03-landing-e-scripts.md)   | O que mudou na landing, roteiro de demo, scripts de WhatsApp, roteiros de vídeo                                                                                                          |
| [vsl/](vsl/)                                         | VSL: roteiro de 3 min e corte de 60 s (`roteiro-vsl.md`), prompts do Higgsfield (`higgsfield-prompts.md`), captura das telas (`captura-telas.md`), storyboard visual (`storyboard.html`) |
| [landing/index.html](landing/index.html)             | Landing page pronta (HTML independente, modelo escuro com acento menta); face: Matheus Passos                                                                                            |

Princípios:

1. **Só prometer o que o código faz e o que decidimos vender.** Inventário na
   seção 1 do posicionamento, com data e commit; refazer a cada release.
2. **O Tauros OS não é PDV.** Toda peça diz "ao lado do seu PDV".
3. **Custo da carcaça é suíno; WhatsApp só envia.** Toda peça respeita os dois.
4. **Trial só com onboarding marcado**; a métrica dos 3 primeiros meses é
   "trial ativado".
5. Preços atuais ficam até 10 pagantes; metas são hipóteses.
6. Pedidos ao produto viram issues no `taurus`; este diretório não altera código.

Decisões abertas (para o responsável):

- Esconder ou rotular os módulos não anunciados no trial.
- Outros açougues como cases (só com autorização por escrito).
- Número do WhatsApp comercial e foto do Matheus na landing.
- VSL: gravar Matheus em câmera e as 8 telas; gerar os 10 clipes no Higgsfield (conta do responsável).
- Stripe em produção ou fluxo manual assumido na landing.
- Co-marketing com o Onbeef: quem aborda e quando.
- Abrir a calculadora de carcaça como página pública (lead magnet).
- Onde este diretório vive (aqui ou no repositório `taurus`).
