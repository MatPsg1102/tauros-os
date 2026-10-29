# Posicionamento — Tauros OS (lançamento: Operação, Produção, Etiquetas, Custo da carcaça e WhatsApp)

> Documento vivo de marketing. Produto: **Tauros OS**, repositório
> `github.com/JulioVianaDev/taurus` (SaaS multi-tenant, NestJS + React).
> Base factual: inventário do código em 2026-10-28 (commit `4567ac2`,
> `version.json` 1.0.13). **Decisão comercial de 2026-10-28:** o lançamento
> vende **Operação (com Equipe e escala), Produção, Etiquetas, Custo da
> carcaça e Relatórios no WhatsApp**. Estoque, Financeiro e o que depende
> deles **não são anunciados como feature** até estarem 100%.

## 1. Escopo de lançamento

### 1.1 O que anunciamos (vendável, em toda peça pública)

| Módulo                     | O que entrega                                                                                                                                                                                                                                                                             | Plano    | Estado |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| **Operação**               | Tarefas recorrentes com horário, responsável e regras; quadro do dia e Kanban; evidência por foto; conferência pelo encarregado (quem fez não aprova); alertas de prazo; tarefas rápidas; relatório de tarefas; edição e exclusão com senha do supervisor; tipos de tarefa personalizados | Básico   | Pronto |
| **Equipe e escala**        | Colaboradores, posições, equipes, turnos, escalas como 12x36, abrir e fechar turno                                                                                                                                                                                                        | Básico   | Pronto |
| **Produção**               | Receitas com ingredientes, custo, modo de preparo e fotos; registro de produção com insumos                                                                                                                                                                                               | Básico   | Pronto |
| **Custo da carcaça**       | Estimativa do suíno vivo ao kg na câmara (quebras de abate e frio, abate, serviço, viagem); lote real pela balança; análise de desossa com margem comercial por corte e estatística de pesos por fornecedor                                                                               | Básico   | Pronto |
| **Etiquetas (Onbeef)**     | Lê o PDF do pedido Onbeef, gera etiquetas 100×80 mm e imprime direto pela caixa de impressão; kits e modelo por loja                                                                                                                                                                      | Básico   | Pronto |
| **Relatórios no WhatsApp** | Fotos de evidência, relatório de conclusão de tarefa e relatório diário automático da operação enviados para números ou grupos; número próprio da loja (pareamento) ou API oficial da Meta                                                                                                | Avançado | Pronto |

Observações:

- **Produção:** o registro de produção pode baixar insumos do estoque. Como
  Estoque não é anunciado, a mensagem pública é "registre a produção e o que
  ela consumiu", sem falar em controle de estoque.
- **Custo da carcaça:** é de **suíno**. Anunciar como "custo da carcaça
  suína e desossa"; bovino não entra.
- **WhatsApp:** o sistema **só envia**. Não é bot, não recebe pedido nem faz
  campanha. Vender como "relatório no grupo que a equipe já usa". A conexão
  por número próprio usa protocolo não oficial; para cliente que exigir
  "oficial", oferecer a API da Meta.

### 1.2 O que existe, mas não anunciamos

| Módulo                          | Por quê não anunciar                       | Como tratar                                                                        |
| ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Estoque (itens, ABC, contagens) | Não está 100% (decisão do responsável)     | Fora de landing, vídeo e proposta. Se perguntarem: "em desenvolvimento, sem data". |
| Compra pela foto da nota        | Depende de Estoque                         | Idem                                                                               |
| Importação de vendas do PDV     | Baixa desligada por flag; corpus sintético | Idem                                                                               |
| Financeiro / DRE                | Não está 100%; receita vem da importação   | Idem                                                                               |
| IA nas fotos de tarefa          | Piloto                                     | Idem                                                                               |
| Treinamento operacional         | Não existe                                 | Manter o card "em breve" já presente na landing.                                   |

**Risco operacional do trial:** o trial de 14 dias libera os recursos do
Avançado, logo Estoque e Financeiro aparecem no menu de quem testa. Pedido ao
produto (ver plano, seção 6): esconder os módulos não anunciados por padrão
ou rotulá-los "acesso antecipado" dentro do sistema.

### 1.3 O que o Tauros OS não é

PDV, caixa, emissor de NF-e/NFC-e, integração com balança, app offline/PWA
(a FAQ da landing diz "aplicação web progressiva": corrigir para "web
responsivo"), CRM/fidelidade, delivery, bot de WhatsApp.

## 2. Diagnóstico da landing atual

A landing (`apps/frontend/src/components/landing/landing-content.ts`) já está
alinhada à parte de Operação: os seis cards falam de processos, tarefas,
turnos, acompanhamento e digitalização. Ajustes necessários:

1. **Produção, Etiquetas, Custo da carcaça e WhatsApp não aparecem.** São
   quatro dos cinco pilares do lançamento e não têm card.
2. **Sem telas reais** nos quatro cards de "veja como funciona" (`image: null`).
3. **FAQ exagera PWA.**
4. **A seção de planos descreve o Avançado com Estoque, Financeiro, WhatsApp
   e IA.** WhatsApp fica; Estoque, Financeiro e IA saem. Ver seção 7.
5. **Cases Atacadão da Carne e Fripoint** vinham da trajetória de Roberto;
   com a troca da face para Matheus, saíram da landing nova. A seção
   "Origem" usa só a casa de carnes Tauros. Reincluir outros nomes apenas com
   relação comprovada e autorização por escrito.

## 3. A quem vendemos (ICP)

**Perfil ideal:** açougue ou casa de carnes com **8 a 50 colaboradores, 1 a 3
lojas**, dono-operador preso na rotina, encarregado identificado, **já tem
PDV**. Já tentou planilha, quadro branco e grupo de WhatsApp para organizar a
equipe e não sustentou. Faz produção própria (linguiça, temperados, espetos,
"Vulcãozinho"). Pontos extras: compra suíno vivo ou carcaça e desossa na
loja; vende no Onbeef.

Sinais de aderência:

- "Se eu viajar uma semana, a loja desanda?" → Operação.
- Encarregado manda foto no grupo para provar que limpou → Conferência com
  foto + relatório no WhatsApp.
- Escala 12x36 ou turnos que trocam e a rotina "some" na troca → Equipe e escala.
- Produto da casa que sai diferente a cada vez → Receitas e produção.
- Compra suíno/carcaça e "descobre a margem no fim do mês" → Custo da carcaça.
- Vende no Onbeef e etiqueta pacote à mão → Etiquetas.

**Perfil secundário:** desossas e pequenos frigoríficos com dezenas de
colaboradores (perfil Fripoint): Operação + Escala + Custo da carcaça;
entrada natural no plano Consultoria.

**Fora do alvo:** açougue de 2–4 pessoas onde o dono faz tudo; redes com ERP
próprio e TI interna; quem procura PDV, nota fiscal, balança ou controle de
estoque (hoje não vendemos isso).

## 4. Personas

- **Dono / sócio ("Seu Marcos")** — quer sair da operação sem perder o
  controle e saber quanto custa de verdade o kg que compra. Mede: dias fora
  da loja sem incêndio; margem da desossa; padrão do produto da casa. Recebe
  o relatório diário no WhatsApp.
- **Encarregado ("Dona Lúcia")** — usa todo dia: quadro, conferência, escala.
  Se ela não adotar, o trial morre. Ganha status com a conferência.
- **Colaborador** — abre turno, tira foto, registra produção. Poucos toques.
  Mensagem interna: "padrão", nunca "fiscalização".
- **Comprador / responsável pela desossa** — calcula o lote antes de fechar
  a compra e analisa a desossa depois.

## 5. Proposta de valor

**Frase-mãe (nova, substitui o bordão antigo):**

> **O PDV vende. O Tauros OS faz a loja funcionar.** Um software nascido de
> dentro de um açougue.

**Promessa em uma frase:** _O açougue funciona do mesmo jeito com ou sem o
dono na loja: a rotina tem dono e hora, a produção sai sempre igual, a
carcaça entra com custo conhecido e o dono recebe o relatório do dia no
WhatsApp._

**Pilares (cada um sustentado por módulo anunciado):**

1. **A loja anda sem você.** Rotinas com horário e responsável, quadro do
   dia, foto como prova, conferência do encarregado, alerta quando o prazo
   chega. _(Operação)_
2. **O padrão não depende de quem está no turno.** Equipes, posições, turnos
   e escalas como a 12x36. _(Equipe e escala)_
3. **O produto da casa sai sempre igual.** Receita com ingredientes, custo,
   modo de preparo e fotos; registro de cada produção. _(Produção)_
4. **Saiba quanto custa de verdade o kg da carcaça.** Do suíno vivo ao kg na
   câmara, antes de fechar a compra; margem por corte depois da desossa.
   _(Custo da carcaça)_
5. **Pedido do Onbeef vira etiqueta em segundos.** _(Etiquetas)_
6. **O relatório do dia chega no seu WhatsApp.** Fotos e resumo da operação
   no grupo que a equipe já usa. _(WhatsApp, Avançado)_
7. **Convive com o que você já tem.** Não troca seu PDV nem sua balança.
8. **Método, não só software.** Quem implanta conheceu a operação de dentro;
   o plano Consultoria coloca um engenheiro de produção na sua semana.

## 6. Diferenciação

Os sistemas para açougue no Brasil (VendaSimples a partir de R$ 84,90/mês,
AçouguePro, TiApps, Linear) vendem **PDV, NFC-e, balança e estoque fiscal**.
Nenhum organiza a rotina da equipe, confere tarefa com foto, padroniza a
produção, calcula o custo da carcaça nem manda o relatório do dia no
WhatsApp. O Tauros OS **não compete** com eles: fica **ao lado do PDV**.

| PDV/ERP de açougue                    | Tauros OS                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Venda, nota, balança, caixa           | Rotina, equipe, escala, produção, custo da carcaça, etiquetas do pedido online |
| Computador do caixa                   | Celular do encarregado, tablet do balcão, WhatsApp do dono                     |
| Relatório que ninguém lê              | Quadro do dia, alerta de prazo, conferência com foto, relatório no grupo       |
| Software genérico de varejo alimentar | Feito dentro de açougue, desossa e frigorífico; vem com método                 |

Posicionamento em uma frase: **"O PDV vende. O Tauros OS faz a loja
funcionar."**

## 7. Planos: impacto da decisão

Hoje (`packages/types/src/entities/billing.entity-type.ts`):

| Plano       | Preço/mês   | Diferença declarada no código                                               |
| ----------- | ----------- | --------------------------------------------------------------------------- |
| Básico      | R$ 199,90   | 1 loja, 10 usuários; Operação, Equipe, Receitas, Produção, Custo da carcaça |
| Avançado    | R$ 499,90   | 3 lojas, usuários ilimitados; + Estoque, Financeiro, **WhatsApp**, IA       |
| Consultoria | R$ 1.999,90 | 5 lojas; + reunião semanal com engenheiro de produção                       |

Com WhatsApp anunciado, **o Avançado mantém um argumento público**: mais
lojas, mais gente e o relatório no WhatsApp. Recomendação para o lançamento
(decisão do responsável; não mexe em preço):

- **Básico** como plano de entrada: "1 loja · Operação, Equipe e escala,
  Produção, Custo da carcaça, Etiquetas".
- **Avançado** como plano recomendado: "até 3 lojas · usuários ilimitados ·
  relatórios no WhatsApp · acesso antecipado a novos módulos". Estoque,
  Financeiro e IA não aparecem pelo nome.
- **Consultoria** continua como "fale com o comercial".
- Etiquetas hoje não tem trava por plano (pendência em `label.controller.ts`);
  anunciá-la no Básico é coerente com o código.
- Trial: "14 dias grátis, sem cartão, com relatórios no WhatsApp incluídos".

## 8. Mensagens por objeção

| Objeção                                | Resposta                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| "Já tenho sistema"                     | Ótimo, mantenha. O Tauros OS organiza o que o PDV não organiza: a equipe, a rotina, a produção e a compra da carcaça.                   |
| "Minha equipe não vai usar"            | O colaborador só abre turno e tira foto. Quem usa é o encarregado, e ele ganha autoridade com a conferência. 14 dias para provar.       |
| "É caro para um açougue"               | Um lote de 100 suínos com R$ 0,20 de erro no kg são quase R$ 1.900. Ou compare com uma hora do seu dia, todo dia. Comece pelo Básico.   |
| "Já tentei planilha/grupo de WhatsApp" | Planilha não cobra prazo nem confere foto; grupo não vira histórico. O Tauros OS manda o relatório pronto para o grupo que você já tem. |
| "Controla estoque? Tem financeiro?"    | Hoje vendemos Operação, Produção, Etiquetas, Custo da carcaça e WhatsApp. Estoque e financeiro estão em desenvolvimento, sem data.      |
| "Só trabalho com bovino"               | O custo da carcaça hoje é para suíno. Os outros módulos servem igual.                                                                   |
| "Funciona sem internet?"               | É web responsivo; precisa de conexão.                                                                                                   |
| "Emite nota? Integra com balança?"     | Não, e não vai competir com seu PDV nisso.                                                                                              |
| "O WhatsApp é oficial?"                | Você escolhe: número próprio da loja por pareamento, ou a API oficial da Meta.                                                          |
| "Quem me implanta?"                    | Onboarding de 30 minutos no trial; no Consultoria, reunião semanal com engenheiro de produção.                                          |

## 9. Marca e nomenclatura

- **Tauros OS** é o nome em todo o código e na landing. Manter.
- **Matheus Passos** é a face (decisão de 2026-10-28): desenvolvedor e
  engenheiro de produção, 7 anos no ramo da carne, dono da casa de carnes
  Tauros. Narrativa: "um software nascido de dentro de um açougue". O
  bordão "Liberdade e profissionalismo" e a figura de Roberto Diamantina
  (presentes no `landing-content.ts` do taurus) saem do material novo.
  Conteúdo de canal na voz do Matheus.
- Domínio ativo: `tauros.io`. Sobras de outros produtos em
  `apps/frontend/public` (realvidas, mynder, dalia, planos bronze/prata/ouro)
  saem antes de qualquer campanha.
- Tom: direto, de operação, sem jargão de software; promessas em processo
  ("padrão", "conferência", "visibilidade"), nunca em percentuais inventados.

## 10. Riscos e lacunas

1. **Módulos não anunciados visíveis no trial** (menu Estoque e Financeiro).
   Esconder por padrão ou rotular "acesso antecipado" antes de abrir trials
   em escala.
2. **Seção de planos da landing lista Estoque, Financeiro e IA** no Avançado.
   Ajustar antes de campanha.
3. **WhatsApp por número próprio usa protocolo não oficial** (risco de
   bloqueio do número pela Meta). Orientar número dedicado da loja e oferecer
   a API oficial a quem exigir.
4. **Custo da carcaça é só suíno.** Toda peça diz "carcaça suína".
5. **Checkout online depende do Stripe configurado**; enquanto não estiver,
   o CTA leva ao trial sem cartão e o pagamento é via comercial.
6. **Cases externos**: a landing nova cita só a casa de carnes Tauros. Qualquer
   outro nome exige relação comprovada e autorização por escrito.
7. **LGPD**: a landing coleta leads e o produto guarda fotos de colaboradores
   e envia para o WhatsApp; publicar termos e política de privacidade
   (`VITE_LANDING_PRIVACY_URL`, `VITE_LANDING_TERMS_URL`).
8. **Etiquetas depende do formato do PDF do Onbeef**: vender como "pedido
   Onbeef", não "qualquer pedido".
