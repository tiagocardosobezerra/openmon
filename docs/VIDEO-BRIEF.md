# Openmon: roteiro das animações do README

Briefing para refazer as duas animações da página do Openmon no GitHub, agora com o **assistente** (Openmon 0.6). Mesmo formato das animações atuais e das referências do **Vegapunk** e do **Zasatsu Bakuto**:

* https://github.com/tiagocardosobezerra/vegapunk
* https://github.com/tiagocardosobezerra/zasatsu-bakuto

No zip:

| Pasta | O que tem |
| --- | --- |
| `atuais/` | As animações de hoje (banner e "por dentro", nos 3 idiomas). Abra no Chrome ou no Edge para ver rodando. As novas substituem estas |
| `criaturas/` | As criaturas usadas nas cenas, com as poses |
| `marca/` | Logo, marca e ícone |
| `telas/` | Prints atuais da interface (assistente, pergunta rápida, balão, card, Opendex, Time) em PT, EN e ES, para copiar o visual |
| `fontes/` | Fredoka (OFL) |

---

## 1. O formato

Não é vídeo `.mp4`: é **SVG animado**. O GitHub mostra o SVG como imagem no README e a animação roda sozinha, em loop, sem player e sem som.

| Item | Especificação |
| --- | --- |
| Tamanho | **1280 × 640** (`viewBox="0 0 1280 640"`) |
| Animação | **CSS `@keyframes`** num `<style>` dentro do SVG. Nada de JavaScript, `<script>`, `<foreignObject>` ou SMIL (`<animate>`): o GitHub remove ou não roda |
| Loop | Todas as animações com a mesma duração total e `animation-iteration-count: infinite`, para a cena voltar ao começo sem pulo |
| Arquivos externos | **Nenhum.** Imagens como SVG inline (de preferência) ou `data:` URI. Fontes em base64 (woff2, só os caracteres usados) ou textos em contorno |
| Peso | Até **250 KB** por arquivo |
| Idiomas | **Três arquivos por animação**: português, inglês e espanhol. Mesma linha do tempo, só os textos mudam |
| Acessibilidade | `role="img"`, `<title>` e um `aria-label` que descreve a animação inteira (textos abaixo). Com `@media (prefers-reduced-motion: reduce)`, mostre a cena final parada |
| Organização | Um comentário no topo com a linha do tempo (`/* Linha do tempo: 56 s. Cena 1 0–7 · … */`) e um comentário por cena |

### Nomes dos arquivos (vão para `assets/`)

| Animação | Português | Inglês | Espanhol |
| --- | --- | --- | --- |
| Banner do topo | `openmon-banner.svg` | `openmon-banner.en.svg` | `openmon-banner.es.svg` |
| Como funciona por dentro | `openmon-dentro.svg` | `openmon-dentro.en.svg` | `openmon-dentro.es.svg` |

---

## 2. Identidade

| Uso | Cor |
| --- | --- |
| Tinta (contornos, texto escuro) | `#2a2140` |
| Roxo da marca | `#7c6cf2` |
| Amarelo (destaques, placa "!", botão principal) | `#ffe156` |
| Creme (balões, ovo) | `#fffdf7` |
| Fundo escuro | do `#15101a` ao `#2a2140` (o fundo do app) |
| Fundo dos balões e cards no escuro | `#241b2c` |
| Vermelho (erro) | `#e5484d` |
| Verde (testes passando) | `#3fb8a6` |

* **Fonte dos títulos:** Fredoka (`fontes/`). Texto corrido: Nunito ou a do sistema, ou em contorno.
* **Estilo:** o das criaturas: contorno grosso cor de tinta, cel shading de 2 tons, cantos arredondados. Balões, card, caixinha e chat copiam a interface real (`telas/`).
* **Marca:** `marca/logo-full-white.svg` no fundo escuro.

---

## 3. Animação 1: banner do topo (56 s)

Em 7 cenas, o que é o Openmon: um bichinho no canto da tela que acompanha o agente de IA, avisa quando ele precisa de você, **é o seu assistente** e evolui com o trabalho.

**Cenário fixo:** a tela de um computador estilizada (fundo escuro), com uma **janela de terminal** à esquerda (o Claude Code trabalhando) e o **Openmon** no canto inferior direito, em cima da barra de tarefas.

```
/* Linha do tempo: 56 s. Cena 1 0–7 · Cena 2 7–15 · Cena 3 15–23 · Cena 4 23–34 · Cena 5 34–42 · Cena 6 42–50 · Cena 7 50–56 */
```

### Cena 1 · 0–7 s · "Ele mora no canto da sua tela"

* Abre na tela vazia. O **ovo** (`criaturas/egg.svg`) aparece no canto com um quique.
* O ovo balança, racha e choca: vira o **Tinkit** (`craft-juvenile.svg`), com um brilho.
* Legenda: **"Um bichinho no canto da sua tela."**
* EN: **"A little creature in the corner of your screen."**
* ES: **"Una mascotita en la esquina de tu pantalla."**

### Cena 2 · 7–15 s · "Ele faz o que o seu agente faz"

* O terminal ganha linhas, uma por vez: `Read checkout.ts` → `Edit cart.ts` → `npm test`.
* O pet troca de pose junto (2,5 s cada): lendo e editando com `craft-juvenile@working.svg`; testando com o escudo. Os testes passam e ele pula (`craft-juvenile@done.svg`) com confete.
* Legenda: **"Ele lê, martela e testa junto com o seu agente."**
* EN: **"It reads, hammers and tests along with your agent."**
* ES: **"Lee, martillea y prueba junto con tu agente."**

### Cena 3 · 15–23 s · "E avisa quando precisa de você"

* O terminal para num pedido de permissão (`Allow Bash: npm publish?`).
* O pet pula com a **placa "!"** (`craft-juvenile@attention.svg`). Aparece o **balão** igual ao do app (`telas/pet-attention.*.png`): "Precisa de você · shop-api", com **Permitir · Recusar**.
* Um cursor clica em **Permitir**: o balão some, o terminal continua, o pet comemora.
* Legenda: **"Precisa de você? Ele avisa. Um clique e você responde."**
* EN: **"Needs you? It tells you. One click and you answer."**
* ES: **"¿Te necesita? Te avisa. Un clic y respondes."**

### Cena 4 · 23–34 s · "E é o seu assistente" (nova)

A cena mais importante da versão nova. Copie a **caixinha de pergunta rápida** de `telas/quick.*.png`.

1. **23–25 s:** aparece um atalho de teclado na tela, `Ctrl` `Alt` `A`, como teclas. A **caixinha** abre ao lado do pet, com o rosto dele e o título "Pergunte a Tinkit".
2. **25–27 s:** o texto é digitado letra por letra: **"Me lembra às 15h de ligar pro João."** (EN: "Remind me at 3 pm to call John." · ES: "Recuérdame a las 15 llamar a Juan.")
3. **27–30 s:** a pergunta sobe como balão roxo. Embaixo aparece a linha pequena do que ele está fazendo, com uma bolinha piscando: `Openmon · remind`. A resposta surge **letra por letra**, com o cursor `▍`: **"Combinado: às 15:00 eu te aviso para ligar pro João. ⏰"**
4. **30–34 s:** a caixinha fecha. Um relógio no canto da barra de tarefas avança rápido até **15:00**. O pet pula e mostra o balão **"⏰ Lembrete · Ligar pro João"**.

* Legenda: **"E é o seu assistente: pergunte, peça, ele lembra."**
* EN: **"And it is your assistant: ask, request, it remembers."**
* ES: **"Y es tu asistente: pregunta, pide, él recuerda."**

### Cena 5 · 34–42 s · "Cresce com o seu trabalho"

* Uma barra de XP enche no card. O pet evolui em sequência, com flash branco entre as formas: `craft-juvenile` → `craft-adult` (Forgemaw) → `craft-mythic` (Archsmith, com aura).
* Ao lado, 4 chips de tipo acendem um por vez: **Forja (editar) · Saber (ler) · Teste (testar) · Escriba (documentar)**, com a criatura jovem de cada um (`craft-juvenile`, `lore-juvenile`, `test-juvenile`, `docs-juvenile`).
* Legenda: **"Ele evolui conforme o trabalho que o agente mais faz."**
* EN: **"It evolves into the kind of work your agent does most."**
* ES: **"Evoluciona según el trabajo que más hace tu agente."**

### Cena 6 · 42–50 s · "Colecione"

* Uma grade da **Opendex** (`telas/dex.*.png`), as formas acendendo da silhueta para a cor, rápido.
* Destaques, um por vez (2 s cada):
  * um **brilhante** (`craft-adult.shiny.svg`) com estrelinhas em volta (veja as notas);
  * um **lendário** (`mergeon.svg`);
  * o **Time**: três Openmons lado a lado no canto da tela (`craft-mythic`, `docs-adult`, `git-juvenile`).
* Legenda: **"39 formas, brilhantes e lendárias. Até 3 na tela."**
* EN: **"39 forms, shiny ones and legendaries. Up to 3 on screen."**
* ES: **"39 formas, brillantes y legendarias. Hasta 3 en pantalla."**

> Não use mais o Openmon **noturno** (com a lua): essa variante saiu do jogo.

### Cena 7 · 50–56 s · fecho

* A tela escurece. O **logo** (`marca/logo-full-white.svg`) aparece no centro, com o Archsmith ao lado.
* Embaixo, os chips: **Claude Code · Assistente · No seu PC · 39 formas · PT · EN · ES** (EN: Claude Code · Assistant · On your PC · 39 forms · PT · EN · ES; ES: Claude Code · Asistente · En tu PC · 39 formas · PT · EN · ES).
* Frase: **"Seu agente trabalha. Seu Openmon cresce e te ajuda."**
* EN: **"Your agent works. Your Openmon grows and helps you."**
* ES: **"Tu agente trabaja. Tu Openmon crece y te ayuda."**
* Segura 2 s e faz fade para a Cena 1.

### `aria-label` do banner

* PT: "Animação do Openmon: um ovo choca no canto da tela; o bichinho lê, martela e testa junto com o agente de IA; quando o agente precisa de permissão, ele pula com uma placa e você responde com um clique; ele também é o seu assistente: você pede um lembrete numa caixinha ao lado dele, e na hora ele avisa; ele evolui com o trabalho e vira uma coleção de 39 formas, com brilhantes e lendários. Seu agente trabalha. Seu Openmon cresce e te ajuda."
* EN: "Openmon animation: an egg hatches in the corner of the screen; the creature reads, hammers and tests along with your AI agent; when the agent needs permission it jumps with a sign and you answer with one click; it is also your assistant: you ask for a reminder in a small box next to it, and on time it tells you; it evolves with the work and becomes a collection of 39 forms, with shiny ones and legendaries. Your agent works. Your Openmon grows and helps you."
* ES: "Animación de Openmon: un huevo eclosiona en la esquina de la pantalla; la mascota lee, martillea y prueba junto con el agente de IA; cuando el agente necesita permiso, salta con un cartel y respondes con un clic; también es tu asistente: pides un recordatorio en una cajita junto a ella y, a la hora, te avisa; evoluciona con el trabajo y se vuelve una colección de 39 formas, con brillantes y legendarias. Tu agente trabaja. Tu Openmon crece y te ayuda."

---

## 4. Animação 2: como funciona por dentro (36 s)

Diagrama animado, como o atual (`atuais/openmon-dentro.svg`): passos da esquerda para a direita, uma legenda por vez no topo, e um "pacotinho" (bolinha amarela) que viaja entre eles. A versão nova ganha um **quinto passo**, o assistente, em que o pacotinho faz a volta: do pet para o Claude e de volta para o pet.

```
/* Linha do tempo: 36 s. 1 O agente avisa 0–6 · 2 Vira sinal 6–12 · 3 O pet decide 12–19 · 4 Aparece na tela 19–26 · 5 E responde 26–36 */
```

| Passo | Tempo | Visual | Legenda PT | Legenda EN | Legenda ES |
| --- | --- | --- | --- | --- | --- |
| 1 · O agente avisa | 0–6 s | Ícones do Claude Code, Gemini CLI, Cursor, OpenCode e Aider em coluna; de um deles sai um evento `PostToolUse · Edit cart.ts` | "Os agentes já avisam o que fazem (hooks)." | "Agents already report what they do (hooks)." | "Los agentes ya avisan lo que hacen (hooks)." |
| 2 · Vira sinal | 6–12 s | O pacote entra numa caixa `127.0.0.1:4747` com um cadeado ("só no seu PC") e sai como etiquetas: `tool-done · craft`, `test-end ✓`, `attention` | "Um servidor local transforma cada aviso em sinal." | "A local server turns each notice into a signal." | "Un servidor local convierte cada aviso en señal." |
| 3 · O pet decide | 12–19 s | Três trilhas acendendo: **Pose** (dormir, trabalhar, pedir ajuda, comemorar), **XP e tipo** (barra enche, chip "Forja"), **Habilidades** (diário de arquivos e testes) | "Ele decide a pose, ganha XP e anota o que o agente fez." | "It picks a pose, earns XP and keeps a log of the work." | "Elige la pose, gana XP y anota lo que hizo el agente." |
| 4 · Aparece na tela | 19–26 s | O pet na área de trabalho com o balão; um ramo tracejado para o celular ("opcional, ntfy") | "Tudo aparece no canto da tela." | "Everything shows up in the corner." | "Todo aparece en la esquina." |
| 5 · E responde (novo) | 26–36 s | Da caixinha ao lado do pet, o pacote vai para uma caixa **"seu Claude Code"** (com o logo do Claude e a etiqueta `claude -p`), dela para uma nuvem pequena **"Anthropic"** e volta. Na volta, ele passa por três etiquetas de **ferramentas do Openmon**: `⏰ lembrete`, `🧠 memória`, `💬 balão`, e termina como resposta na caixinha. Um selo na caixa: "seu login, seus conectores, sem chave de API" | "E responde como seu assistente, com o seu Claude Code." | "And answers as your assistant, with your own Claude Code." | "Y responde como tu asistente, con tu propio Claude Code." |

Faixa fixa no topo: **"Escuta. Cresce. Avisa. Ajuda."** / EN: **"Listens. Grows. Tells you. Helps."** / ES: **"Escucha. Crece. Avisa. Ayuda."**

Rodapé discreto, no passo 5: **"O Openmon não manda nada a mais: o assistente é o seu Claude Code."** / EN: **"Openmon sends nothing more: the assistant is your Claude Code."** / ES: **"Openmon no envía nada más: el asistente es tu Claude Code."**

### `aria-label` do diagrama

* PT: "Como o Openmon funciona por dentro: os agentes de IA avisam cada passo por hooks; um servidor local em 127.0.0.1:4747 transforma cada aviso em sinal; o pet decide a pose, ganha experiência e registra o que o agente fez; tudo aparece no canto da tela; e, como assistente, ele responde usando o seu próprio Claude Code, que pode criar lembretes, guardar o que deve lembrar e falar pelo balão. O Openmon não manda nada a mais."
* EN: "How Openmon works inside: AI agents report each step through hooks; a local server at 127.0.0.1:4747 turns each notice into a signal; the pet picks a pose, earns experience and logs what the agent did; everything shows up in the corner of the screen; and, as your assistant, it answers with your own Claude Code, which can set reminders, keep what it should remember and speak through the bubble. Openmon sends nothing more."
* ES: "Cómo funciona Openmon por dentro: los agentes de IA avisan cada paso por hooks; un servidor local en 127.0.0.1:4747 convierte cada aviso en señal; la mascota elige la pose, gana experiencia y registra lo que hizo el agente; todo aparece en la esquina de la pantalla; y, como asistente, responde con tu propio Claude Code, que puede crear recordatorios, guardar lo que debe recordar y hablar por la burbuja. Openmon no envía nada más."

---

## 5. Notas sobre as criaturas e a interface

* As criaturas em `criaturas/` têm o nome do app: `<forma>[.shiny][@pose].svg`. Poses: `@sleep`, `@working`, `@attention`, `@error`, `@done`.
* **Brilhante:** os arquivos `.shiny` vêm sem as estrelinhas (o app desenha). Na animação, desenhe só estrelas de 4 pontas `#fffbe0` com contorno `#e9a92a` em volta, piscando uma depois da outra, **sem halo nem anel**.
* **Movimento do pet (igual ao app):** respiração (escala 1 → 1,03 em 2,4 s), pulinho na troca de pose, piscar a cada 3–4 s, tremidinha no erro, giro na evolução.
* **A caixinha** (cena 4): fundo `#241b2c`, contorno de tinta 2,5 px, cantos 18 px. A pergunta é um balão roxo `#7c6cf2` à direita; a resposta é um balão escuro à esquerda, com contorno fino. "Responder" é o botão amarelo. Veja `telas/quick.*.png`.
* **O assistente** (se quiser um quadro a mais na cena 4): `telas/assistant.*.png` mostra a janela, com a linha de passos dobrada ("4 passos · editou 1 · leu 1 · rodou 2") e o código colorido.
* `telas/` também tem o balão (`pet-attention`), o card (`pet-card`), a Opendex (`dex`) e o Time (`party`), em PT, EN e ES.

---

## 6. Checklist de entrega

- [ ] 6 arquivos: `openmon-banner.svg`, `openmon-banner.en.svg`, `openmon-banner.es.svg`, `openmon-dentro.svg`, `openmon-dentro.en.svg`, `openmon-dentro.es.svg`
- [ ] 1280 × 640, CSS `@keyframes`, loop sem pulo, sem JavaScript e sem arquivos externos
- [ ] Até 250 KB cada
- [ ] `<title>`, `role="img"` e `aria-label` em cada um (textos acima)
- [ ] Com `prefers-reduced-motion`, mostra a cena final parada
- [ ] Sem o Openmon noturno; brilhante sem halo
- [ ] Testado abrindo o SVG direto no Chrome e no Firefox
