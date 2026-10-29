# Plano de go-to-market — Tauros OS (lançamento: Operação, Produção, Etiquetas, Custo da carcaça e WhatsApp)

> Complementa `01-posicionamento.md`. O produto já tem landing, planos, trial
> de 14 dias e formulário de lead. Este plano trata de **levar gente até lá,
> converter o trial em pagante e aprender rápido**, dentro do escopo de
> lançamento. Metas são hipóteses até os 10 primeiros pagantes.

## 1. Estratégia em três movimentos

**Movimento 1 — Fundador vende (meses 1–3).** Matheus vende um a um, por demonstração, para açougues da rede direta. Objetivo: 10 pagantes, 3
histórias reais autorizadas, lista de objeções literal.

**Movimento 2 — Conteúdo + indicação (meses 2–6).** Vídeos curtos no pátio e
no balcão, na voz do Matheus; programa de indicação; parcerias com quem já
fala com centenas de açougues (Onbeef, fornecedores de suíno, frigoríficos).

**Movimento 3 — Aquisição medida (a partir do mês 4).** Só depois de saber o
custo de um trial ativado e a taxa trial→pagante: anúncios no Instagram/Meta
e Google para "sistema para açougue" e termos de operação, com a landing já
corrigida. Se até então Estoque/Financeiro estiverem 100%, o lançamento
deles entra como campanha própria ("novos módulos"), com inventário refeito.

## 2. Oferta por porta de entrada

A dor que o visitante traz define por onde ele entra. Todas levam ao mesmo
trial, mas a conversa e a primeira semana mudam.

| Porta (dor)                                  | Módulo de entrada   | Primeira vitória no trial (até 7 dias)                                  | Plano natural |
| -------------------------------------------- | ------------------- | ----------------------------------------------------------------------- | ------------- |
| "A loja depende de mim"                      | Operação            | 10 rotinas recorrentes criadas; encarregado conferiu 5 tarefas com foto | Básico        |
| "Na troca de turno a rotina some"            | Equipe e escala     | Escala montada; turno aberto 5 dias seguidos                            | Básico        |
| "Meu produto da casa sai diferente cada vez" | Produção            | 3 receitas cadastradas com foto; 3 produções registradas                | Básico        |
| "Compro suíno/carcaça e não sei o custo"     | Custo da carcaça    | 1 lote real calculado e 1 desossa analisada com margem                  | Básico        |
| "Vendo no Onbeef e etiqueto à mão"           | Etiquetas           | Primeiro pedido impresso em etiqueta no trial                           | Básico        |
| "Quero saber do dia sem ligar para a loja"   | WhatsApp            | Relatório diário chegando no grupo do dono por 5 dias                   | Avançado      |
| "Tenho 2 ou 3 lojas"                         | Operação multi-loja | Rotinas padronizadas nas lojas; relatório de cada uma no WhatsApp       | Avançado      |
| "Quero alguém que organize comigo"           | Consultoria         | Diagnóstico da operação na 1ª reunião                                   | Consultoria   |

Regra: **o trial só começa com um horário de onboarding marcado** (30 min,
com o encarregado presente). Trial sem onboarding é trial morto. No
onboarding, conectar o WhatsApp e mandar o primeiro relatório ao vivo: é a
"primeira vitória" mais rápida que existe.

## 3. Canais (ordem de prioridade)

1. **Venda direta por WhatsApp e demonstração** (fundador). Script em
   `03-landing-e-scripts.md`. Meta: 5 demos por semana.
2. **Rede da casa de carnes Tauros**: fornecedores, frigoríficos,
   representantes, outros donos que o Matheus já conhece.
   Indicação com 1 mês grátis para quem indica e para o indicado.
3. **Onbeef como parceiro.** O Tauros OS lê o pedido do Onbeef e imprime a
   etiqueta: benefício direto para a base deles. Propor co-marketing (post
   conjunto, menção na base, webinar para lojas Onbeef).
4. **Fornecedores de suíno, granjas e abatedouros de serviço.** Conhecem
   todos os açougues que compram carcaça. Material: o vídeo "quanto custa de
   verdade o kg da carcaça" e uma conta feita ao vivo com o lote do cliente
   deles.
5. **Conteúdo curto em vídeo (Instagram/TikTok/YouTube Shorts).** Matheus no
   pátio ou no balcão da Tauros, 40–60 s, um problema por vídeo, tela no fim. Quatro
   trilhas: _rotina_, _produção_, _carcaça_, _etiquetas/Onbeef_; o relatório
   no WhatsApp aparece como fechamento dos vídeos de rotina. Dois por semana.
6. **Grupos de WhatsApp/Facebook de açougueiros, casas de carnes e
   suinocultura.** Compartilhar o vídeo, responder dúvidas, nunca spam.
7. **Eventos do setor** (feiras de supermercado e carnes, encontros de
   suinocultura e frigoríficos). Levar tablet: calcular a carcaça do
   visitante e criar as 10 rotinas da loja dele na hora.
8. **Busca orgânica.** Artigos nas perguntas que o dono digita: "como
   organizar a equipe do açougue", "checklist de limpeza de açougue",
   "escala 12x36 açougue", "ficha técnica de linguiça artesanal",
   "custo do kg da carcaça suína", "rendimento de desossa suína",
   "etiqueta pedido Onbeef".

Adiar: anúncios pagos (até medir o funil), marketplaces de software, revenda
por integradores de PDV, qualquer peça sobre estoque/financeiro.

## 4. Funil e mensuração

```
Vídeo/indicação/parceiro → landing (tauros.io) → lead (form/WhatsApp)
→ demo 20 min → trial 14 dias com onboarding → pagante → indicação
```

| Etapa                   | Como medir                                          | Meta 90 dias (hipótese) |
| ----------------------- | --------------------------------------------------- | ----------------------- |
| Visitas na landing      | `components/landing/analytics.ts` + eventos por CTA | 3.000                   |
| Leads (form + WhatsApp) | Admin `/admin/leads` + planilha do comercial        | 120                     |
| Demos realizadas        | Agenda do comercial                                 | 50                      |
| Trials com onboarding   | `/admin/assinaturas` (status trial) + checklist     | 30                      |
| Trials ativados         | Definição abaixo                                    | 18                      |
| Pagantes                | Stripe/manual em `/admin/assinaturas`               | 10                      |
| Churn nos 60 dias       | Cancelamentos ÷ pagantes                            | ≤ 1                     |

**Trial ativado** (o único número que importa nos 3 primeiros meses): ≥ 10
rotinas recorrentes criadas, encarregado conferiu ≥ 5 tarefas com foto,
turno aberto em ≥ 5 dias na primeira semana e WhatsApp conectado com
relatório diário chegando; se a porta foi Produção, Carcaça ou Etiquetas,
somar 3 produções registradas, 1 lote calculado ou 1 pedido impresso. Quem
não ativa em 7 dias recebe ligação, não e-mail.

## 5. Plano de 90 dias

**Semanas 1–2 — Arrumar a casa**

- Corrigir a landing (lista em `03-landing-e-scripts.md`, seção 1): cards de
  Produção, Etiquetas, Custo da carcaça e WhatsApp; telas reais; FAQ sem PWA;
  seção de planos sem Estoque/Financeiro/IA; enquadramento dos cases.
- Esconder ou rotular "acesso antecipado" os módulos não anunciados no trial.
- Publicar termos e política de privacidade; preencher `VITE_LANDING_*`.
- Confirmar Stripe em produção ou deixar o fluxo manual explícito.
- Gravar 5 vídeos (um por trilha + um institucional com o Matheus na Tauros).
- Montar o tenant de demonstração: açougue fictício com 15 rotinas, escala
  12x36, 3 receitas com foto, 1 lote de carcaça e 1 desossa, 1 pedido Onbeef
  impresso, WhatsApp conectado a um grupo de demonstração.

**Semanas 3–6 — 30 conversas**

- Listar 60 açougues da rede direta; abordar 30 por WhatsApp (script).
- 20 demos; 12 trials com onboarding; publicar 2 vídeos por semana.
- Proposta formal de co-marketing para o Onbeef; conversa com 3
  fornecedores de suíno sobre indicação.
- Decidir se outros açougues entram como cases (só com autorização por escrito).

**Semanas 7–12 — Converter e aprender**

- Converter trials; registrar objeções literais e o módulo que "virou a
  chave" em cada venda. Contar quantas vezes pediram estoque/financeiro e
  bovino: alimenta a priorização do produto.
- 3 depoimentos em vídeo de pagantes (30 s cada).
- Publicar os 7 artigos de busca orgânica.
- Decidir com dados: qual porta converte melhor, se o WhatsApp sustenta o
  Avançado, e se vale ligar anúncios.

## 6. Pedidos ao produto (saem como issues no repositório `taurus`)

Pedidos, não compromissos; nada aqui altera código por si.

1. **Esconder módulos não anunciados** (Estoque, Financeiro, IA) para novos
   tenants, ou rotular "acesso antecipado" no menu. Sem isso o trial mostra
   o que decidimos não vender.
2. **Landing:** cards de Produção, Etiquetas, Custo da carcaça e WhatsApp;
   telas reais; FAQ sem "PWA"; seção de planos sem Estoque/Financeiro/IA;
   selo "em breve" mantido no Treinamento.
3. **Instrumentação do funil:** eventos de CTA na landing; marcação de
   "trial ativado" no admin (rotinas, conferências, turnos, produções, lotes,
   etiquetas, WhatsApp conectado).
4. **Onboarding guiado no `/startup`**: criar as 10 primeiras rotinas a partir
   de modelos de açougue e conectar o WhatsApp no mesmo fluxo.
5. **Relatório diário para o dono** além do grupo: confirmar que o fluxo de
   primeiro uso cobre esse caso.
6. **Trava por plano em Produção e Etiquetas** (pendência conhecida em
   `label.controller.ts`), coerente com o que a landing anunciar.
7. **Limpar assets de outros produtos** em `apps/frontend/public`.
8. **Lead magnet:** calculadora de custo da carcaça como página pública (sem
   login) com captura de WhatsApp. O módulo existe; abrir uma versão pública
   é decisão de produto.

## 7. Orçamento mínimo (meses 1–3)

Sem mídia paga. Custos: tempo do fundador (5 demos/semana), um editor de
vídeo freelancer (2 vídeos/semana), domínio e e-mail já existentes, um
tenant de demonstração com número de WhatsApp dedicado. Primeiro gasto em
mídia só com funil medido.
