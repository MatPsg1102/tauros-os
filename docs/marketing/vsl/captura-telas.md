# Captura das telas do Tauros OS para a VSL

> As telas são a parte que converte: têm de ser **reais**, do sistema rodando
> com dados plausíveis. Nada de mock. Gravar antes de gerar o B-roll, porque o
> ritmo da edição segue as telas.

## Preparação (uma vez)

1. **Tenant de demonstração** (ou o tenant da Tauros com dados revisados):
   loja "Tauros · Centro", 15 rotinas recorrentes, escala 12x36 montada,
   1 turno aberto, 2 tarefas atrasadas, 1 tarefa aguardando conferência com
   2 fotos, 3 receitas com foto (ex.: linguiça toscana, tempero da casa,
   espeto misto), 1 produção registrada, 1 lote de carcaça e 1 desossa
   salvos, 1 pedido Onbeef com etiquetas geradas, WhatsApp conectado a um
   grupo "Gestão Loja Centro".
2. **Esconder o que não é anunciado**: Estoque, Financeiro e IA não podem
   aparecer no menu lateral. Enquanto o produto não tiver a trava/ocultação,
   gravar com um perfil sem esses módulos ou cortar o menu no enquadramento.
3. **Sem dados sensíveis**: nomes de fornecedor e preços reais de compra
   fora; usar nomes de colaboradores fictícios se o tenant for o da Tauros.
4. **Navegador**: Chrome, janela 1920×1080, zoom 110 %, sem extensões, barra
   de favoritos oculta, tema do sistema escuro. Cursor com destaque suave.
5. **Gravador**: OBS (ou a captura nativa do Windows), 1080p60, sem
   microfone (a voz é gravada à parte). Celular: gravação de tela nativa +
   uma tomada externa do celular na mão de Matheus.

## Telas (na ordem da VSL)

| ID  | Rota / lugar                                | O que mostrar (8–12 s de gravação, usa-se 6–10)                                                                                            | Cuidado                                               |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| T0  | Landing `landing/index.html`                | Hero com "O PDV vende. O Tauros OS faz a loja funcionar." e rolagem lenta até os cards.                                                    | Número do WhatsApp já configurado.                    |
| T1  | `/operacao`                                 | Quadro do dia carregando; faixa de atrasadas no topo; passar o mouse em uma tarefa atrasada.                                               | Menu sem Estoque/Financeiro.                          |
| T2  | `/operacao/kanban` → detalhe da tarefa      | Abrir "Ilhas e geladeiras" com 2 fotos; clicar Conferir; mostrar Aprovar e Devolver com motivo; devolver com um motivo curto.              | Mostrar que quem executou não aparece como aprovador. |
| T3  | `/escala` e `/turno` (abrir turno)          | Semana 12x36 com as posições preenchidas; abrir o turno do dia.                                                                            | Nomes fictícios.                                      |
| T4  | `/receitas/$id` → `/producao`               | Receita com foto, ingredientes e custo; registrar uma produção com quantidade.                                                             | Não falar em "estoque" no áudio.                      |
| T5  | `/custo-carcaca`                            | Estimativa: 100 suínos × 115 kg, quebras, abate/serviço/viagem → custo final; mudar o preço do vivo; abrir a Desossa com margem por corte. | Dados do vetor canônico (R$ 7,49/kg; margem 22,58 %). |
| T6  | `/etiquetas` → `/etiquetas/$jobId`          | Subir o PDF do pedido Onbeef; gerar; "Gerar e imprimir" abrindo a caixa de impressão.                                                      | Pedido fictício; logo do Onbeef só na tela real.      |
| T7  | Celular (gravação de tela + tomada externa) | Grupo do WhatsApp recebendo o relatório diário e uma foto de evidência; Matheus segurando o celular no pátio.                              | Número do grupo oculto; sem contatos reais.           |
| T8  | Landing, seção Planos                       | Rolagem até os três planos; destaque no Avançado (card menta).                                                                             | Preços conferidos com `billing.entity-type.ts`.       |

## Montagem

- Edição: CapCut ou DaVinci Resolve. Linha do tempo: voz → telas → B-roll →
  legendas → trilha.
- Voz gravada à parte (celular com fone de lapela, ambiente silencioso),
  depois sincronizada; Matheus em câmera só nas cenas 1, 4, 5, 14 e 16.
- Legendas geradas automaticamente e revisadas; frases-chave em caixa alta.
- Exportar 16:9 1080p (landing/YouTube) e 9:16 1080×1920 (Reels/TikTok).
- Publicar na landing como vídeo hospedado (YouTube não listado ou arquivo
  próprio); o artifact não embute iframe, então na versão HTML usar link ou
  `<video>` com arquivo próprio.

## Checklist antes de publicar

- [ ] Nenhuma tela de Estoque, Financeiro ou IA aparece, nem no menu.
- [ ] Nenhum nome de fornecedor, preço real de compra ou telefone real.
- [ ] Preços dos planos iguais aos do sistema.
- [ ] "Carcaça suína" dito ou escrito; nunca "bovino".
- [ ] WhatsApp descrito como "relatórios e fotos", nunca "bot" ou "atendimento".
- [ ] Legendas revisadas; CTA e link no fim.
