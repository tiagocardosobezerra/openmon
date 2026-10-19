# Openmon: roteiro das animações do README

Briefing para criar as duas animações da página do Openmon no GitHub, no mesmo formato das que já existem no **Vegapunk** e no **Zasatsu Bakuto**:

* https://github.com/tiagocardosobezerra/vegapunk
* https://github.com/tiagocardosobezerra/zasatsu-bakuto

Os arquivos de referência estão no zip, na pasta `referencias/`. Abra num navegador (Chrome ou Edge) para ver as animações rodando.

---

## 1. O formato (igual ao das referências)

Não é vídeo `.mp4`: é **SVG animado**. O GitHub mostra o SVG como imagem no README e a animação roda sozinha, em loop, sem player e sem som.

| Item | Especificação |
| --- | --- |
| Tamanho | **1280 × 640** (`viewBox="0 0 1280 640"`) |
| Animação | **CSS `@keyframes`** dentro de um `<style>` no próprio SVG. Nada de JavaScript, `<script>`, `<foreignObject>` ou SMIL (`<animate>`): o GitHub remove ou não roda |
| Loop | Todas as animações com a mesma duração total e `animation-iteration-count: infinite`, para a cena voltar ao começo sem pulo |
| Arquivos externos | **Nenhum.** Imagens embutidas como SVG inline (de preferência) ou `data:` URI. Fontes embutidas em base64 (woff2, só os caracteres usados) ou textos convertidos em contorno |
| Peso | Até **250 KB** por arquivo (as referências têm entre 95 e 225 KB) |
| Idiomas | **Dois arquivos por animação**: português e inglês, mesma linha do tempo, só os textos mudam |
| Acessibilidade | `role="img"`, `<title>` e um `aria-label` que descreve a animação inteira (veja o texto de cada uma abaixo). Respeite `@media (prefers-reduced-motion: reduce)`: nesse caso, mostre a cena final parada |
| Organização | Um comentário no topo com a linha do tempo, como nas referências: `/* Linha do tempo: 48 s. Cena 1 0–7 · Cena 2 7–13 · … */` e um comentário por cena |

### Nomes dos arquivos (vão para `assets/` no repositório)

| Animação | Português | Inglês |
| --- | --- | --- |
| Banner do topo | `openmon-banner.svg` | `openmon-banner.en.svg` |
| Como funciona por dentro | `openmon-dentro.svg` | `openmon-dentro.en.svg` |

O banner atual (`referencias/openmon-banner-atual.svg`) é estático; o novo substitui ele.

---

## 2. Identidade

| Uso | Cor |
| --- | --- |
| Tinta (contornos, texto escuro) | `#2a2140` |
| Roxo da marca | `#7c6cf2` |
| Amarelo (destaques, placa "!") | `#ffe156` |
| Creme (balões, ovo) | `#fffdf7` |
| Fundo escuro do banner | do `#2a2140` ao `#3d2f6b` (como o banner atual) |
| Vermelho (erro, Opendex) | `#e5484d` |

* **Fonte dos títulos:** Fredoka (OFL), na pasta `fontes/`. Texto corrido: uma sans-serif simples (Nunito ou a do sistema), ou converta em contorno.
* **Estilo:** o mesmo das criaturas: contorno grosso cor de tinta, cel shading de 2 tons, cantos arredondados. Balões e cards copiam a interface real (veja `telas/`).
* **Marca:** `marca/logo-full-white.svg` no fundo escuro.

---

## 3. Animação 1: banner do topo (48 s)

Mostra, em 6 cenas, o que é o Openmon: um bichinho no canto da tela que acompanha o agente de IA, avisa quando ele precisa de você e evolui com o trabalho.

**Cenário fixo:** a tela de um computador estilizada (fundo escuro), com uma **janela de terminal** à esquerda (o Claude Code trabalhando) e o **Openmon** no canto inferior direito, em cima da barra de tarefas.

```
/* Linha do tempo: 48 s. Cena 1 0–7 · Cena 2 7–15 · Cena 3 15–24 · Cena 4 24–34 · Cena 5 34–42 · Cena 6 42–48 */
```

### Cena 1 · 0–7 s · "Ele mora no canto da sua tela"

* Abre na tela vazia. O **ovo** (`criaturas/egg.svg`) aparece no canto com um quique.
* O ovo balança, racha e choca: vira o **Sprout** (`sprout.svg`) com um brilho.
* Legenda: **"Um bichinho no canto da sua tela."**
* EN: **"A little creature in the corner of your screen."**

### Cena 2 · 7–15 s · "Ele faz o que o seu agente faz"

* O terminal à esquerda ganha linhas, uma por vez: `Read checkout.ts` → `Edit cart.ts` → `npm test`.
* O pet troca de pose junto (2,5 s cada):
  * lendo: `craft-juvenile@working.svg` com um livrinho (ou só a pose working)
  * editando: `craft-juvenile@working.svg` com o martelinho
  * testando: escudo; os testes passam, ele pula (`craft-juvenile@done.svg`) com confete
* Legenda: **"Ele lê, martela e testa junto com o seu agente."**
* EN: **"It reads, hammers and tests along with your agent."**

### Cena 3 · 15–24 s · "E avisa quando precisa de você"

* O terminal para numa pergunta de permissão (`Allow Bash: npm publish?`).
* O pet pula segurando a **placa "!"** (`craft-juvenile@attention.svg`). Aparece o **balão** igual ao da interface (veja `telas/pet-attention.*.png`): "Precisa de você · alpha", com os botões **Permitir · Sempre · Recusar**.
* Um cursor clica em **Permitir**: o balão some, o terminal continua sozinho, o pet comemora.
* Legenda: **"Precisa de você? Ele avisa. Um clique e você responde."**
* EN: **"Needs you? It tells you. One click and you answer."**

### Cena 4 · 24–34 s · "Cresce com o seu trabalho"

* Uma barra de XP enche no card. O pet evolui em sequência, com flash branco entre as formas (como no jogo):
  `craft-juvenile` → `craft-adult` (Forgemaw) → `craft-mythic` (Archsmith, com aura)
* Ao lado, 4 chips de tipo acendem um por vez, mostrando que o tipo vem do trabalho: **Forja (editar) · Saber (ler) · Teste (testar) · Escriba (documentar)**, com a criatura jovem de cada um (`craft-juvenile`, `lore-juvenile`, `test-juvenile`, `docs-juvenile`).
* Legenda: **"Ele evolui conforme o trabalho que o agente mais faz."**
* EN: **"It evolves into the kind of work your agent does most."**

### Cena 5 · 34–42 s · "Colecione"

* Uma grade da **Opendex** aparece (inspiração: `telas/dex.*.png`), formas acendendo da silhueta para a cor, rápido.
* Destaques, um por vez (1,5 s cada):
  * um **shiny** com halo dourado e estrelinhas (`craft-adult.shiny.svg` + o brilho, ver nota abaixo)
  * um **noturno** com a lua (`roam-adult.night.svg`)
  * um **lendário** (`mergeon.svg`)
  * o **Time**: três Openmons lado a lado no canto da tela (`craft-mythic`, `docs-adult`, `git-juvenile`)
* Legenda: **"40 formas, raras e lendárias. Até 3 na tela."**
* EN: **"40 forms, rare ones and legendaries. Up to 3 on screen."**

### Cena 6 · 42–48 s · fecho

* A tela escurece; o **logo** (`marca/logo-full-white.svg`) aparece no centro, com o Archsmith ao lado.
* Embaixo, os chips: **Claude Code · 100% local · 40 formas · PT · EN · ES**.
* Frase: **"Seu agente trabalha. Seu Openmon cresce."**
* EN: **"Your agent works. Your Openmon grows."**
* Segura 2 s e faz fade para a Cena 1.

### `aria-label` do banner

* PT: "Animação do Openmon: um ovo choca no canto da tela; o bichinho lê, martela e testa junto com o agente de IA; quando o agente precisa de permissão, ele pula com uma placa e você responde com um clique; ele evolui conforme o trabalho e vira uma coleção de 40 formas, com raros e lendários. Seu agente trabalha. Seu Openmon cresce."
* EN: "Openmon animation: an egg hatches in the corner of the screen; the creature reads, hammers and tests along with your AI agent; when the agent needs permission it jumps with a sign and you answer with one click; it evolves with the work and becomes a collection of 40 forms, with rare ones and legendaries. Your agent works. Your Openmon grows."

---

## 4. Animação 2: como funciona por dentro (30 s)

Um diagrama animado, como o `vegapunk-sonar.svg` e o `zasatsu-dominio.svg`: quatro passos da esquerda para a direita, uma legenda por vez no topo, e um "pacotinho" (bolinha amarela) que viaja entre eles.

```
/* Linha do tempo: 30 s. 1 O agente avisa 0–7 · 2 Vira sinal 7–14 · 3 O pet decide 14–22 · 4 Aparece na tela 22–30 */
```

| Passo | Tempo | Visual | Legenda PT | Legenda EN |
| --- | --- | --- | --- | --- |
| 1 · O agente avisa | 0–7 s | Ícones do Claude Code, Gemini CLI, Cursor, OpenCode e Aider em coluna; de um deles sai um evento `PostToolUse · Edit cart.ts` | "Os agentes já avisam o que fazem (hooks)." | "Agents already report what they do (hooks)." |
| 2 · Vira sinal | 7–14 s | O pacote entra numa caixa `127.0.0.1:4747` com um cadeado ("só no seu PC") e sai como etiquetas: `tool-done · craft`, `test-end ✓`, `attention` | "Um servidor local transforma cada aviso em sinal." | "A local server turns each notice into a signal." |
| 3 · O pet decide | 14–22 s | Três trilhas acendendo: **Pose** (dormir, trabalhar, pedir ajuda, comemorar), **XP e tipo** (barra enche, chip "Forja"), **Poderes** (diário de arquivos, testes, consertos) | "Ele decide a pose, ganha XP e anota o que o agente fez." | "It picks a pose, earns XP and keeps a log of the work." |
| 4 · Aparece na tela | 22–30 s | O pet na área de trabalho com o balão; um ramo opcional, tracejado, para o celular ("opcional, ntfy") | "Tudo aparece no canto da tela. Nada sai do seu PC." | "Everything shows up in the corner. Nothing leaves your PC." |

Faixa fixa no topo (como no Vegapunk): **"Escuta. Cresce. Avisa."** / EN: **"Listens. Grows. Tells you."**

### `aria-label` do diagrama

* PT: "Como o Openmon funciona por dentro: os agentes de IA avisam cada passo por hooks; um servidor local em 127.0.0.1:4747 transforma cada aviso em um sinal; o pet decide a pose, ganha experiência e registra o que o agente fez; tudo aparece no canto da tela, sem sair do seu computador."
* EN: "How Openmon works inside: AI agents report each step through hooks; a local server at 127.0.0.1:4747 turns each notice into a signal; the pet picks a pose, earns experience and logs what the agent did; everything shows up in the corner of your screen without leaving your computer."

---

## 5. Notas sobre as criaturas

* Todas as criaturas estão em `criaturas/`, com o nome do arquivo igual ao do app: `<forma>[.shiny][.night][@pose].svg`. Poses: `@sleep`, `@working`, `@attention`, `@error`, `@done`.
* **Shiny:** os arquivos `.shiny` vêm sem o brilho (o app desenha). Na animação, desenhe o brilho por cima, como na prancha "shiny" do seu arquivo: halo `#fff1b8` com 45% de opacidade, anel pontilhado `#f2b632` e estrelas de 4 pontas `#fffbe0` com contorno `#e9a92a`, piscando uma depois da outra.
* **Movimento do pet (para ficar igual ao app):** respiração (escala 1 → 1,03 em 2,4 s), pulinho na troca de pose, piscar a cada 3–4 s, tremidinha no erro, giro na evolução.
* Acessórios (`acessorios/`) e itens (`itens/`) podem enfeitar a cena 5, mas não são obrigatórios.
* `telas/` tem prints atuais da interface (card, balão, Opendex, Time, Mochila, Poderes, Configurações) em PT e EN, para copiar o visual dos balões e cards.

---

## 6. Checklist de entrega

- [ ] 4 arquivos: `openmon-banner.svg`, `openmon-banner.en.svg`, `openmon-dentro.svg`, `openmon-dentro.en.svg`
- [ ] 1280 × 640, CSS `@keyframes`, loop sem pulo, sem JavaScript e sem arquivos externos
- [ ] Até 250 KB cada
- [ ] `<title>`, `role="img"` e `aria-label` em cada um (textos acima)
- [ ] Com `prefers-reduced-motion`, mostra a cena final parada
- [ ] Testado abrindo o SVG direto no Chrome e no Firefox
