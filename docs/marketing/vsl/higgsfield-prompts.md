# Prompts para o Higgsfield — B-roll da VSL

> O Higgsfield gera vídeo a partir de texto ou de uma imagem (imagem → vídeo
> com preset de câmera). Fluxo recomendado para consistência visual: gerar ou
> fotografar **uma imagem** por cena, aprovar, e só então animar com um preset
> de câmera. Mudar **uma variável por vez** (imagem, movimento, prompt,
> modelo) quando o resultado sair errado; fixar o `seed` quando acertar.
> Prompts em inglês (os modelos respondem melhor); descrição em pt-BR ao lado.

## Parâmetros padrão

- Duração: 5 s por clipe (a VSL usa 3–5 s de cada).
- Formato: gerar em 16:9; regenerar em 9:16 os clipes H1, H2, H5 e H7 para
  o corte de 60 s.
- Estilo global (colar no fim de todo prompt):
  `cinematic, photorealistic, Brazilian butcher shop, cool fluorescent light with teal highlights, dark shadows, shallow depth of field, 35mm, no text, no logos, no visible faces`
- Negativo (quando o modelo aceitar): `text, watermark, logo, cartoon, extra fingers, distorted hands, readable screen UI`
- Nunca gerar a interface do Tauros OS. Telas são gravação real.
- Se o Higgsfield permitir imagem de referência, use fotos reais da Tauros
  (câmara, balcão, desossa) como base: o B-roll fica com a cara da loja.

## Clipes

| ID  | Cena da VSL | Prompt (imagem)                                                                                                                                                                                     | Movimento de câmera (preset)        | Descrição pt-BR                                                  |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| H1  | 2, 60s      | Open walk-in cold room door in a butcher shop at dawn, cold vapor rolling out across the tiled floor, hanging pork carcasses in the background, empty hallway, single overhead light, nobody around | Slow dolly in (push in)             | Câmara fria aberta de madrugada, vapor saindo, ninguém por perto |
| H2  | 3           | Close-up of a digital thermometer display on a stainless steel cold room door, condensation droplets, blurred butcher shop behind, dim light                                                        | Static with subtle handheld sway    | Termômetro da câmara em close, ninguém conferindo                |
| H3  | 3           | A smartphone lying face up on a stainless steel butcher counter, screen glowing with a blurred group chat full of photo thumbnails, meat cuts out of focus behind, no readable text                 | Top-down slow orbit (arc left)      | Celular no balcão com grupo cheio de fotos (sem texto legível)   |
| H4  | 3           | Two butchers in white coats and caps passing each other at a shop entrance during shift change, one leaving with keys, one arriving tying an apron, seen from behind, early evening light           | Tracking shot following from behind | Troca de turno, um sai e outro entra, de costas                  |
| H5  | 3, 60s      | Fresh Brazilian sausage links being hand-tied on a stainless steel production table, seasoning bowls, sausage stuffer machine in background, warm light on the meat, cool light elsewhere           | Macro slide right                   | Linguiça artesanal sendo amarrada na mesa de produção            |
| H6  | 3           | A whole pork carcass hanging on a hook being weighed on an industrial hanging scale in a cold room, scale dial blurred, breath vapor in the air                                                     | Low angle crane up                  | Carcaça suína pendurada na balança da câmara                     |
| H7  | 12, 60s     | Thermal label printer on a butcher shop counter spitting out a strip of white 100 x 80 mm labels onto vacuum-packed meat packages, close-up, no readable text on labels                             | Crash zoom then hold                | Impressora térmica cuspindo etiquetas sobre pacotes a vácuo      |
| H8  | 5           | Wide shot of a modern Brazilian butcher shop interior from the entrance, glass display counters full of cuts, clean tiles, staff silhouettes working, cool white light with teal accents            | FPV sweep forward into the shop     | Plano aberto da loja, entrando pela porta                        |
| H9  | 14          | Deboning room: gloved hands separating a pork leg (pernil) on a white cutting board, knife mid-cut, stainless surfaces, blue-white light, close framing on hands only                               | Slow push in on the hands           | Desossa em close nas mãos, sem rosto                             |
| H10 | 17          | Abstract near-black background with a single soft teal glow rising like a monitor phosphor, fine grain, no objects, no text                                                                         | Static, slow light bloom            | Fundo escuro com brilho menta para o logo final                  |

## Como usar no Higgsfield (passo a passo)

1. **Imagem primeiro.** Gere a imagem de cada cena com o prompt da tabela +
   o estilo global. Aprove 1 imagem por cena (mesma luz, mesma paleta).
2. **Imagem → vídeo.** Suba a imagem aprovada, escolha o preset de câmera da
   coluna "Movimento", 5 s. Guarde o `seed` dos que aprovar.
3. **Uma variável por vez.** Saiu errado? Troque só o movimento, ou só o
   prompt, ou só o modelo. Não mude tudo junto.
4. **9:16.** Para o corte de 60 s, regenere H1, H2, H5 e H7 em vertical,
   enquadrando o objeto no centro.
5. **Exportar** na maior resolução disponível, sem marca d'água, e nomear
   `H1-camara-16x9.mp4` etc. Guardar em `docs/marketing/vsl/clips/` (fora do
   Git; a pasta é só convenção local).

## O que não gerar

- Interface do Tauros OS, celular com texto legível, etiquetas com texto.
- Rostos reconhecíveis (clientes, funcionários).
- Logotipos (Onbeef, WhatsApp): aparecem só nas gravações reais de tela.
- Cenas de bovino como se fossem o módulo de carcaça (ele é suíno).

## Status (2026-10-29)

Imagens H1–H10 **geradas** no Higgsfield com o modelo **Soul Cinema**, 16:9,
0,125 crédito cada, na conta gratuita (uma geração por vez). Ficam em
Assets → Images na conta do responsável. GPT Image 2 exige plano Starter;
**imagem → vídeo com referência exige plano Plus ou superior** (não assinado).

| ID  | Resultado                                            | Observação                                                  |
| --- | ---------------------------------------------------- | ----------------------------------------------------------- |
| H1  | Porta da câmara aberta, vapor, luz menta             | Aprovada para o corte                                       |
| H2  | Visor quadrado na porta de aço, condensação          | Serve; o visor saiu como painel, não termômetro de ponteiro |
| H3  | Celular no balcão com tela desfocada, carne ao fundo | Aprovada                                                    |
| H4  | Dois açougueiros de jaleco, de costas, na porta      | Aprovada; conferir se não há rosto visível                  |
| H5  | Linguiça sendo amarrada na mesa de inox              | Aprovada                                                    |
| H6  | Balança de ponteiro com carcaça pendurada            | Carcaça pequena no quadro; regenerar se sobrar crédito      |
| H7  | Impressora térmica com etiquetas em branco           | Aprovada                                                    |
| H8  | Plano aberto da loja com vitrines                    | Aprovada                                                    |
| H9  | Mãos com luva desossando pernil                      | Aprovada                                                    |
| H10 | Fundo escuro com brilho menta                        | Aprovada                                                    |

Sem plano de vídeo, usar as imagens como B-roll estático com movimento de
câmera no editor (zoom lento de 3–5 %, deslocamento suave), ou substituir
por gravações reais na Tauros. As versões 9:16 (H1, H2, H5, H7) ainda não
foram geradas.

### Arquivos baixados (2026-10-29)

Os 10 PNGs originais (1696×960, 1,3–2,0 MB cada) estão em
`docs/marketing/vsl/clips/` (pasta ignorada pelo Git), nomeados
`H1-camara-fria.png` … `H10-fundo-menta.png`. Fonte: CDN do Higgsfield; os
mesmos arquivos continuam em Assets → Images na conta.
