# Landing, demo e scripts de venda — Tauros OS (lançamento: Operação, Produção, Etiquetas, Custo da carcaça e WhatsApp)

> Textos prontos para uso, dentro do escopo de lançamento definido em
> `01-posicionamento.md`. **A landing nova está pronta em
> [`landing/index.html`](landing/index.html)** (HTML independente, modelo
> visual escuro com acento menta; publicada para revisão em
> https://claude.ai/artifact/J5QdYsaJmFnMQPogu6VC7t). A landing antiga em
> `apps/frontend/src/components/landing/landing-content.ts` do `taurus`
> (bordão "Liberdade e profissionalismo", face Roberto Diamantina, cases
> Atacadão/Fripoint) é substituída por ela; a seção 1 abaixo descreve o que
> mudou de uma para a outra.
> Nenhuma peça aqui menciona Estoque, Financeiro, compra por foto,
> importação de vendas ou IA.

## 1. Ajustes na landing atual

### 1.1 Manter da landing antiga

Bloco "dono ou refém", metodologia, trial sem cartão, formulário de lead e
botão de WhatsApp. **Sai:** o bordão "Liberdade e profissionalismo" (hero
novo: "O PDV vende. O Tauros OS faz a loja funcionar."), a seção do Roberto
(vira "Quem fez": Matheus Passos, desenvolvedor e engenheiro de produção, 7
anos no ramo da carne, dono da casa de carnes Tauros) e os cases externos
(viram a seção "Origem", só com a Tauros). Os cards atuais de Processos padronizados, Gestão de
tarefas, Turnos e escala, Acompanhamento gerencial e Digitalização de rotinas
ficam. Treinamento operacional continua "em breve".

### 1.2 Cards a acrescentar na seção de funcionalidades

7. **CONFERÊNCIA COM FOTO** · Quem fez não aprova a própria tarefa. O
   encarregado confere, aprova ou devolve com motivo; mudanças sensíveis
   pedem senha do supervisor. · _Benefício:_ prova do que foi feito, sem
   depender de confiança cega.
8. **RECEITAS E PRODUÇÃO** · O produto da casa sai sempre igual: receita
   com ingredientes, custo, modo de preparo e fotos. Cada produção fica
   registrada, com o que consumiu. · _Benefício:_ padrão de qualidade que não
   depende de quem está na produção.
9. **CUSTO DA CARCAÇA SUÍNA E DESOSSA** · Do suíno vivo ao kg na câmara, com
   quebras de abate e frio, abate, serviço e viagem. Lote real pela balança
   e desossa com margem por corte. · _Benefício:_ decidir a compra com
   número, não com feeling.
10. **ETIQUETAS DO PEDIDO ONBEEF** · O PDF do pedido vira etiquetas de
    100×80 mm prontas para a impressora térmica, em segundos, sem digitar. ·
    _Benefício:_ menos erro de embalagem e tempo de balcão de volta.
11. **RELATÓRIOS NO WHATSAPP** · As fotos de evidência e o relatório diário
    da operação chegam no grupo que a sua equipe já usa, ou direto no seu
    número. · _Benefício:_ saber do dia sem ligar para a loja. · _Plano
    Avançado._

Subtítulo sugerido para a seção: **O PDV vende. O Tauros OS faz a loja
funcionar.**

### 1.3 Seção "Veja como funciona"

Trocar os quatro placeholders por telas reais do tenant de demonstração:
quadro do dia com atrasadas em destaque; conferência com foto; análise de
desossa com margem por corte; relatório diário chegando no WhatsApp.
Opcionais: escala 12x36, receita com foto, etiquetas de um pedido Onbeef.
Legenda de uma linha em cada.

### 1.4 Planos

- **Básico**: "1 loja · Operação, Equipe e escala, Produção, Custo da
  carcaça, Etiquetas".
- **Avançado** (recomendado): "Até 3 lojas · usuários ilimitados ·
  relatórios no WhatsApp · acesso antecipado a novos módulos". **Remover**
  os nomes Estoque, Financeiro e IA da lista pública.
- **Consultoria**: "Até 5 lojas · reunião semanal com engenheiro de
  produção", botão "Falar com o comercial".
- Texto do trial: "14 dias grátis, sem cartão, com relatórios no WhatsApp.
  Onboarding de 30 minutos incluído."

### 1.5 Origem (no lugar dos cases)

Três cards sobre a casa de carnes Tauros: na loja (rotina com dono e hora),
na produção (produto da casa sempre igual), na compra (carcaça com custo
conhecido). Trocar por depoimentos de clientes pagantes assim que houver
autorização.

### 1.6 FAQ (corrigir e completar)

- **Substitui meu PDV?** Não. O Tauros OS fica ao lado do seu sistema de
  vendas e organiza o que ele não organiza: a equipe, a rotina, a produção e
  a compra da carcaça.
- **Controla estoque? Tem financeiro?** Ainda não fazem parte do que
  oferecemos. Estamos construindo e avisaremos os clientes primeiro.
- **O custo da carcaça serve para bovino?** Hoje é para suíno. Os demais
  módulos servem para qualquer açougue.
- **O WhatsApp é oficial? Ele responde cliente?** Ele só envia relatórios e
  fotos para a sua equipe. Você conecta o número da loja ou usa a API
  oficial da Meta.
- **Emite nota ou integra com balança?** Não, e não é esse o papel dele.
- **Funciona no celular?** Sim, é web responsivo: celular, tablet e
  computador, com internet. _(remover "aplicação web progressiva")_
- **Funciona com qualquer pedido online?** As etiquetas hoje leem o pedido
  do Onbeef.
- **Como pago?** Cartão pelo site; PIX e boleto com o comercial. Sem
  fidelidade.
- **Tenho mais de uma loja?** Uma assinatura cobre até 3 lojas no Avançado e
  5 no Consultoria.
- **Meus dados ficam separados?** Cada conta tem o próprio banco de dados.

### 1.7 Higiene antes de campanha

Publicar termos e privacidade; remover imagens de outros produtos de
`apps/frontend/public`; conferir se o checkout do Stripe está ativo ou se o
CTA cai no fluxo manual; eventos de clique nos CTAs em `analytics.ts`;
esconder (ou rotular "acesso antecipado") Estoque e Financeiro no menu de
novos tenants.

## 2. Roteiro de demonstração (20 minutos)

Preparar: tenant de demonstração com açougue fictício, 15 rotinas, escala
12x36, 1 turno aberto, 1 tarefa aguardando conferência com foto, 3 receitas
com foto, 1 produção registrada, 1 lote de carcaça e 1 desossa salvos, 1
pedido Onbeef com etiquetas geradas, WhatsApp conectado a um grupo de
demonstração em que o cliente possa entrar. Encarregado do cliente na
chamada. **Menu sem Estoque e Financeiro.**

1. **(2 min) Pergunta de abertura:** "Se você sumir uma semana, o que
   acontece na loja?" Anotar: é a porta de entrada.
2. **(5 min) Operação:** quadro do dia com atrasadas no topo → abrir uma
   tarefa → foto → alerta de prazo → conferir como encarregado → devolver com
   motivo. Frase: "quem fez não aprova; quem confere ganha autoridade".
3. **(2 min) WhatsApp:** a foto da tarefa e o relatório do dia chegam no
   grupo de demonstração, com o cliente vendo no próprio celular. Frase:
   "você sabe do dia sem ligar para a loja".
4. **(2 min) Equipe e escala:** 12x36 montada; a rotina não depende de quem
   está no turno.
5. **(3 min) Produção:** receita do produto da casa com foto e custo →
   registrar uma produção. Frase: "sai igual com qualquer funcionário".
6. **(3 min) Custo da carcaça (se compra suíno/carcaça):** estimativa com os
   números do cliente → "e se eu pagar R$ X?" → desossa com margem por
   corte. Senão, pular.
7. **(1 min) Etiquetas (se vende no Onbeef):** subir o PDF do pedido → gerar
   → imprimir. Senão, pular.
8. **(2 min) Fechamento:** "Começamos o trial hoje com onboarding na quinta
   às 15h, com a [encarregada]. Conectamos o WhatsApp na hora e em 7 dias
   você tem 10 rotinas rodando e o relatório chegando todo dia. Fechado?"

Se perguntarem de estoque ou financeiro: "estão em desenvolvimento, sem
data; quando saírem, você sabe primeiro". Não abrir as telas.

Nunca mostrar: módulos não anunciados, IA, funcionamento offline. Nunca
chamar o WhatsApp de "bot" ou "atendimento".

## 3. Scripts de WhatsApp

**Abordagem (rede direta):**

> Oi, [nome]. Aqui é o Matheus, dono da casa de carnes Tauros e criador do
> Tauros OS, um sistema de operação de açougue que nasceu dentro da minha loja. Não é PDV: organiza rotina, equipe, escala e
> produção ao lado do sistema que você já tem, e manda o relatório do dia no
> seu WhatsApp. Posso te mostrar em 20 minutos como fica a sua loja nele?
> Tenho [dia] às [hora] ou [dia] às [hora].

**Abordagem (quem compra suíno/carcaça):**

> Oi, [nome]. Uma pergunta rápida: hoje você sabe quanto está custando o kg
> da carcaça antes de fechar a compra, ou só fecha o mês? Tenho um sistema
> que faz essa conta em 1 minuto (quebras, abate, frete, desossa). Posso te
> mostrar com um lote seu?

**Lead da landing (responder em até 1 hora):**

> Oi, [nome], vi que você pediu uma demonstração do Tauros OS pela [loja].
> Me conta em uma frase: hoje o que mais te prende na operação? Com isso eu
> monto a demonstração em cima do seu caso.

**Dia 3 do trial (sem ativação):**

> [nome], vi que as rotinas ainda não entraram. É normal, a semana come o
> tempo. Me passa 15 minutos com a [encarregada] hoje ou amanhã e eu cadastro
> as 10 primeiras com vocês, ao vivo, e deixo o relatório chegando no seu
> WhatsApp.

**Dia 12 do trial (conversão):**

> [nome], em 12 dias foram [n] tarefas conferidas, [n] relatórios no seu
> WhatsApp e [n] produções registradas. Seguimos no Avançado (R$ 499,90, até
> 3 lojas, com os relatórios no WhatsApp)? Se for só 1 loja e sem WhatsApp,
> o Básico sai por R$ 199,90. Pix e boleto também servem.

**Perguntas de qualificação (planilha):** nº de colaboradores e lojas; PDV
atual; quem é o encarregado; escala (12x36, turnos); produção própria
(quais produtos); compra suíno vivo, carcaça ou cortes prontos?; suínos por
semana; vende no Onbeef?; já usa grupo de WhatsApp com a equipe?; "se você
viajar uma semana…".

## 4. Roteiros de vídeo curto (Matheus na Tauros, 40–60 s)

Trilha **rotina**

1. "Quem conferiu a câmara fria às 6h?" → alerta de prazo + foto + conferência → relatório no WhatsApp.
2. "Dono ou refém?" → quadro do dia visto do celular, fora da loja.
3. "O encarregado aprova a própria limpeza?" → regra de conferência.
4. "Troca de turno, some a rotina" → escala 12x36 e turno aberto.
5. "O relatório do dia chegou antes de eu perguntar" → WhatsApp do dono.

Trilha **produção**

6. "O Vulcãozinho sai sempre igual" → receita com custo e fotos.
7. "Quanto custa a sua linguiça artesanal?" → custo da receita por ingrediente.
8. "Quem fez o lote de hoje?" → registro de produção.

Trilha **carcaça**

9. "Quanto custa de verdade o kg da carcaça?" → estimativa: vivo → abate → frio → custo final.
10. "O erro dos 2,5%" → quebra de frio incide sobre o peso abatido, não sobre o vivo.
11. "O pernil subiu e você não repassou" → desossa: mudar o R$/kg e ver a margem mudar.

Trilha **etiquetas / Onbeef**

12. "Pedido do Onbeef virou etiqueta em 10 segundos" → PDF → impressora.
13. "Pacote errado, cliente perdido" → kits e modelo de etiqueta.

Regras: câmera na mão, legenda em pt-BR, tela do sistema nos últimos 10 s,
link na bio e nos comentários, nenhum número de cliente ou preço de
fornecedor sem autorização, nenhuma tela de estoque ou financeiro no
enquadramento.
