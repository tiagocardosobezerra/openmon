# Openmon: briefing de arte 2 (mons novos e coleção)

Este é o segundo briefing de arte do Openmon. O primeiro ([ART-BRIEF.md](ART-BRIEF.md)) criou a logomarca e as 22 formas que já estão no app. Este pede o que vem depois:

1. **Mons novos**: 5 tipos novos, formas regionais, evoluções alternativas, lendários e visuais de época.
2. **Coleção**: a tela do Time e da Caixa, acessórios novos e ícones de itens.

Tudo segue o **mesmo estilo** das 22 formas atuais. Use as artes de `art/official/` como referência: elas são a régua.

As instruções estão em português. Os prompts estão em inglês, porque os geradores de imagem entendem melhor.

---

## 0. Antes de começar

### O que é o Openmon

Um pet de desktop que vive no canto da tela e cresce com o trabalho de um agente de IA de programação (como o Claude Code). O **tipo** do pet vem do trabalho que o agente mais faz: editar arquivos dá o tipo Forja, ler dá Saber, rodar testes dá Teste, e assim por diante. Os tipos novos deste briefing nascem de trabalhos que hoje o app ainda não reconhece.

### O estilo (igual ao briefing 1)

- Chibi/kawaii, corpo arredondado, cabeça e corpo numa peça só.
- Contorno grosso e uniforme `#2a2140`, cerca de 3% da altura da figura.
- Sombreamento cel em 2 tons e 1 brilho suave no topo. Sem gradiente realista.
- Olhos grandes e brilhantes, bochechas `#ff7f9f` a 55%, bracinhos curtos, dois pezinhos ovais.
- Vista frontal levemente 3/4, como um sticker.
- **Regra de ouro:** cada forma reconhecível **só pela silhueta, a 64 px**. A evolução muda o formato do corpo, não só a cor.
- **Criaturas originais.** Nada que lembre um Pokémon ou Digimon específico, nem Pokébola. Nada de **logos reais** (Python, Rust, Go, Git, GitHub, Java etc.): são marcas registradas. Sugira o tema, não copie o símbolo.

### Bloco de estilo

Cole no fim de todo prompt de criatura:

```
original chibi creature mascot, kawaii, round squishy body, thick uniform dark outline (#2a2140),
flat cel shading with one soft highlight, big shiny eyes, rosy cheeks, tiny stubby arms, two small oval feet,
front three-quarter view, full body, centered, feet touching the bottom edge, sticker style,
clean vector look, transparent background, no text, no shadow on the ground, no background,
consistent with a cute desktop pet game, readable at small sizes
--no pokeball, pokemon, logo, text, watermark, background, realistic, 3D render
```

### Regra técnica que faz os olhos piscarem (importante)

O app gera sozinho as piscadas, os olhos felizes e o olhar para os lados, lendo os olhos de dentro do SVG. Para isso funcionar:

- Cada pupila é **uma elipse ou um círculo** com a classe `k` (`<ellipse class="k" …>`), uma de cada lado, **espelhadas** em relação ao centro da figura e na mesma altura.
- Os brilhos do olho são círculos brancos com a classe `w` em cima da pupila.
- Se o olho tiver esclera (parte branca em volta), ela é um círculo ou elipse com `fill="#fff"` centrado na pupila.
- Não junte pupila e contorno num único `path`.

Se a arte vier em PNG, tudo bem: ela aparece, só não pisca. Por isso, **prefira SVG**.

### O que NÃO desenhar

O app desenha por cima, e anima: placa "!", martelo, livro, escudo, luneta, terminal, "Zzz", confete, corações, migalhas, a aura dos estágios comuns e **os acessórios** (chapéus, cachecóis). Desenhe só a criatura.

---

## Item 1: mons novos

### 1.1 Cinco tipos novos (15 formas)

Cada tipo tem 3 formas: **Jovem** (`juvenile`), **Adulto** (`adult`) e **Mítico** (`mythic`). O Jovem é pequeno e simples; o Adulto ganha o traço marcante do tipo; o Mítico é maior, mais detalhado e tem um elemento de brilho próprio. Os nomes são sugestões: se tiver nomes melhores, proponha.

| Tipo | Vem de (trabalho do agente) | Ideia visual | Olhos (a partir do Adulto) |
| --- | --- | --- | --- |
| **Escriba** (`docs`) | escrever documentação e textos | criatura de papel e tinta: orelhas de página dobrada, cauda de pena | gentis, com cílios de traço de pena |
| **Ramo** (`git`) | commits, branches, pull requests | criatura-broto de madeira cujos galhos se dividem e se juntam | redondos e atentos, com íris de anel de árvore |
| **Caçador** (`debug`) | falhar e corrigir (erros resolvidos) | besourinho detetive com antenas, élitro e lupa no rosto | um olho normal e um ampliado "pela lupa" |
| **Cristal** (`data`) | banco de dados, SQL, planilhas, notebooks | criatura de cristal facetado, com dados "brilhando" por dentro | facetados, com brilho em losango |
| **Pincel** (`style`) | CSS, design, interfaces | camaleão-pintor com cauda de pincel e manchas de tinta | grandes, com íris em degradê de duas cores chapadas |

#### Paleta por tipo

| Tipo | Corpo | Sombra | Barriga | Detalhe | Brilho/aura (Mítico) |
| --- | --- | --- | --- | --- | --- |
| Escriba | `#f3ead6` | `#d9c9a6` | `#fffaf0` | tinta `#3b5bdb`, pena `#ffffff` | `#c5d3ff` |
| Ramo | `#c7835a` | `#9c5e3b` | `#f6dcc4` | folhas `#5fd4a0`, nós `#7a4a30` | `#b8f5d6` |
| Caçador | `#e5484d` | `#b8323a` | `#ffd9d6` | élitro `#3a2f55`, pintas `#ffd166`, lente `#bfe9ff` | `#ffb1a8` |
| Cristal | `#5fc8e8` | `#3a98bd` | `#e2f7ff` | facetas `#9ee6ff`, núcleo `#7c6cf2` | `#c9f2ff` |
| Pincel | `#ffb3d1` | `#e787b0` | `#fff0f6` | tinta `#ffd166`, `#5fb3ff`, `#74cc63` | arco-íris pastel chapado |

#### Formas e prompts

**Escriba (docs)**

- **#023 Inkling** (`docs-juvenile`)
  ```
  small round cream #f3ead6 paper creature, one ear shaped like a folded page corner, a tiny ink drop #3b5bdb on its cheek, belly #fffaf0
  ```
- **#024 Quillmane** (`docs-adult`)
  ```
  sturdy cream #f3ead6 paper creature with a mane of layered page edges, a long white feather quill tail #ffffff dipped in blue ink #3b5bdb, kind eyes with pen-stroke lashes, belly #fffaf0
  ```
- **#025 Archivist** (`docs-mythic`)
  ```
  larger majestic paper creature, a floating open book halo above its head, quill tail, blue ink rune patterns #3b5bdb on its body, soft blue aura #c5d3ff, calm wise eyes
  ```

**Ramo (git)**

- **#026 Twiglet** (`git-juvenile`)
  ```
  small round warm wood #c7835a creature, a single mint leaf sprout #5fd4a0 on top, little knot spots #7a4a30, belly #f6dcc4
  ```
- **#027 Branchoak** (`git-adult`)
  ```
  sturdy wooden #c7835a creature whose two antler-like branches split and rejoin in a loop, small mint leaves #5fd4a0, tree-ring irises, belly #f6dcc4
  ```
- **#028 Mergewood** (`git-mythic`)
  ```
  larger ancient tree spirit creature, many branches braiding into one crown, glowing mint #b8f5d6 sap lines along the branches, small leaf cape, proud tree-ring eyes
  ```

**Caçador (debug)**

- **#029 Mitey** (`debug-juvenile`)
  ```
  small round red #e5484d beetle creature, two short antennae, tiny yellow #ffd166 spots, dark wing case #3a2f55 on its back, curious eyes
  ```
- **#030 Beetlock** (`debug-adult`)
  ```
  sturdy red #e5484d detective beetle creature, a monocle-like magnifying lens #bfe9ff over one eye, longer antennae, dark wing case #3a2f55 with yellow spots, focused expression
  ```
- **#031 Bugbane** (`debug-mythic`)
  ```
  larger heroic red beetle creature, shining dark wing case that opens slightly like a cape, crest horn, magnifying lens eye, warm coral aura #ffb1a8, brave expression
  ```

**Cristal (data)**

- **#032 Cubit** (`data-juvenile`)
  ```
  small rounded cube-shaped cyan #5fc8e8 crystal creature, soft facets #9ee6ff, a tiny purple glowing core #7c6cf2 in its chest, belly #e2f7ff
  ```
- **#033 Prismora** (`data-adult`)
  ```
  sturdy faceted cyan #5fc8e8 crystal creature with crystal shoulder spikes, rows of tiny glowing dots inside its body like a table, diamond-shaped eye highlights, belly #e2f7ff
  ```
- **#034 Datanaut** (`data-mythic`)
  ```
  larger majestic crystal creature, orbiting small crystal cubes, a glowing purple core #7c6cf2 visible through its chest, icy aura #c9f2ff, wise faceted eyes
  ```

**Pincel (style)**

- **#035 Dabbit** (`style-juvenile`)
  ```
  small round pink #ffb3d1 chameleon creature, a short curled tail with a yellow paint tip #ffd166, two paint spots on its body, big eyes, belly #fff0f6
  ```
- **#036 Palettail** (`style-adult`)
  ```
  sturdy pink #ffb3d1 painter chameleon creature, a long curled tail ending in a fluffy paint brush, palette-shaped crest with three paint dots #ffd166 #5fb3ff #74cc63, two-tone eyes
  ```
- **#037 Chromancer** (`style-mythic`)
  ```
  larger majestic painter chameleon, body patterns shifting in flat pastel rainbow stripes, brush tail trailing a ribbon of paint, crest like a color wheel, joyful two-tone eyes
  ```

Para cada forma nova, entregue também a **shiny** (mesma forma, outra cor; proponha a paleta), a **noturna** (cor puxada para o azul-meia-noite `#2b2f6b`, barriga `#c9d4ff`, lua crescente amarela na testa ou em outro lugar livre) e as **5 poses** (`@sleep`, `@working`, `@attention`, `@error`, `@done`), iguais às do briefing 1.

### 1.2 Formas regionais (pela linguagem do projeto)

Um pet criado num projeto principalmente em uma linguagem ganha uma **forma regional**: a mesma forma, com outra paleta e uma **marca** pequena que lembra a linguagem. É como as formas regionais do Pokémon: mesmo bicho, sotaque diferente.

Não use os logos oficiais. A marca é um **tema**, desenhado no estilo do Openmon.

| Região | Linguagens | Paleta (corpo / sombra / detalhe) | Marca (pequena, no corpo ou na testa) |
| --- | --- | --- | --- |
| **Chaves** (`js`) | JavaScript, TypeScript | `#ffd75e` / `#e0b23a` / `#3178c6` | um par de chaves `{ }` como pintas |
| **Serpente** (`py`) | Python | `#5b8fd6` / `#3e6cad` / `#ffd34d` | escamas em losango ao longo das costas |
| **Ferrugem** (`rs`) | Rust | `#c8693c` / `#9a4a26` / `#4fb3a0` (pátina) | manchas de pátina e uma engrenagem de 5 dentes |
| **Correnteza** (`go`) | Go | `#5fd0e0` / `#38a6b8` / `#ffffff` | linhas de velocidade, como água corrente |
| **Grão** (`jvm`) | Java, Kotlin | `#8b5e3c` / `#664229` / `#f2c14e` | fumacinha de vapor e um grão de café |
| **Sustenido** (`cs`) | C#, .NET | `#8a6ad6` / `#6648b5` / `#e8dcff` | um sinal `#` desenhado como cicatriz fofa |

**O que entregar (escolha um caminho):**

- **Caminho rápido (recomendado para começar):** a paleta acima ajustada por você, a marca de cada região como **SVG separado** (`mark-js.svg`, `mark-py.svg`…, centrada em 0,0, cerca de 24 × 24 unidades) e **6 exemplos prontos** (o Jovem de Forja em cada região). O app recolore as outras formas e aplica a marca sozinho.
- **Caminho completo:** cada forma das 6 linhagens originais em cada região, desenhada à mão (até 108 arquivos). Pode vir aos poucos: o que faltar, o app gera pelo caminho rápido.

### 1.3 Evoluções alternativas (opcional, fase 2)

Formas que aparecem por um caminho diferente, como no Pokémon:

- **Por amizade:** um Mítico alternativo para quem chega a amizade 100 antes de evoluir. Sugestão: o mesmo Mítico com um laço de fita e um coração na aura. Comece com 2 exemplos (Forja e Saber).
- **Por pedra de tipo:** uma pedra para cada tipo (veja os ícones no item 2.3) que, segurada, puxa a evolução para aquele tipo. Não precisa de forma nova, só dos ícones.

### 1.4 Lendários e visuais de época (opcional, fase 2)

**Três lendários**, raríssimos, cada um ligado a um feito:

| Lendário | Como aparece | Ideia visual |
| --- | --- | --- |
| **Mergeon** | o primeiro pull request aceito | dragãozinho feito de dois rios que se unem num só, escamas em tons de azul e verde |
| **Aeonbyte** | um ano de Openmon | criatura de ampulheta com areia de pixels dourados e anéis de órbita |
| **Zeroday** | 100 bugs corrigidos | guardião de armadura branca com um olho único e calmo, capa de luz |

Cada lendário tem uma forma só, com normal, shiny e noturna, e as 5 poses.

**Visuais de época** (em fevereiro, outubro, dezembro…): não são formas novas. São **acessórios** temporários (item 2.2) e uma **paleta de época** opcional (por exemplo, abóbora em outubro, branco e vermelho em dezembro).

### 1.5 Forma de foco (sem arte nova)

Quando o agente faz mais de 50 ações seguidas, o pet fica gigante e brilhante até o fim da tarefa. O app faz isso sozinho. Só peço, se der, uma **moldura de aura** em SVG (`aura-focus.svg`, um anel de energia chapado, 512 × 512, centro transparente) para dar personalidade a esse momento.

---

## Item 2: coleção

### 2.1 Time e Caixa

Cada projeto pode ter o seu Openmon. Até **6** ficam no **Time** (aparecem no app); os outros ficam na **Caixa**, como no PC do Pokémon. Preciso de:

| Peça | Especificação |
| --- | --- |
| **Fundo da Caixa** | 12 papéis de parede para as caixas, 960 × 540 px, chapados e calmos (céu, floresta, praia, deserto, neve, noite, oficina, biblioteca, laboratório, cidade, jardim, espaço). Pouco contraste, porque os mons ficam por cima |
| **Ícone de Time** | um ícone para a aba Time e outro para a aba Caixa, 24 × 24 e 48 × 48, no estilo dos ícones do app (traço grosso `#2a2140`) |
| **Lugar vazio** | o espaço de um membro que falta no Time: um ninho ou uma almofadinha (nada de Pokébola), 128 × 128 |
| **Selo de projeto** | uma plaquinha com espaço para o nome do projeto, que aparece embaixo de cada mon, 160 × 40, com área de texto livre |

As miniaturas dos mons (ícones de 64 px) o app gera a partir da arte principal.

### 2.2 Acessórios novos (18)

Os 12 acessórios atuais são desenhados em código (boné, chapéu de festa, gorro, fones, flor, touca, chapéu de mago, coroa, cachecol, gravata-borboleta, bandana, medalha). Os novos podem vir **como SVG** e o app posiciona sozinho na cabeça ou no pescoço de qualquer forma.

**Regras de desenho:**

- Fundo transparente, mesmo contorno `#2a2140`, mesmo sombreamento cel.
- **Chapéus (`head`):** desenhe para uma cabeça de **100 unidades de largura**. A base do chapéu fica em `y = 0`, centralizada em `x = 0` (o app encaixa esse ponto no topo da cabeça). Pode subir até 120 unidades.
- **Pescoço (`neck`):** desenhe para um corpo de **100 unidades de largura**. O centro fica em `0,0` (o app encaixa na linha do pescoço). Altura de até 50 unidades.
- **Rosto (`face`, slot novo):** óculos e máscaras, desenhados para dois olhos a **40 unidades** de distância um do outro, centro entre os olhos em `0,0`.

| Acessório | Slot | Como se conquista (sugestão) |
| --- | --- | --- |
| Óculos redondos | face | ler 3.000 arquivos |
| Óculos escuros | face | 20 dias seguidos |
| Monóculo | face | 50 bugs corrigidos |
| Máscara de herói | face | uma tarefa com 100 ações |
| Capacete de obra | head | 500 comandos no terminal |
| Coroa de folhas | head | 100 commits |
| Chapéu de explorador | head | 200 páginas da web |
| Gorro de chef | head | 30 dias de missões cumpridas |
| Laço | head | amizade 100 |
| Tiara de estrelas | head | completar a Opendex original |
| Chapéu de abóbora | head | outubro (época) |
| Gorro de Natal | head | dezembro (época) |
| Chapéu de festa dourado | head | aniversário de 1 ano |
| Gravata | neck | 50 pull requests |
| Colar de pérolas | neck | 7 dias perfeitos |
| Capa | neck | chegar a um lendário |
| Sininho | neck | dar 100 carinhos |
| Mochilinha | neck | encher a Mochila (todos os itens) |

### 2.3 Ícones de itens (14)

Mesmo estilo dos três ícones atuais (Biscoito, Bala rara, Pedra eterna): objeto simples, contorno grosso, 1 brilho. **SVG, desenhado em 40 × 40 unidades**, legível a 24 px.

| Item | Ideia |
| --- | --- |
| Pedra Forja, Saber, Terminal, Teste, Viagem, Enxame | 6 pedras lapidadas, cada uma na cor e com um símbolo simples do tipo (bigorna, livro, `>_`, escudo, asa, colmeia) |
| Pedra Escriba, Ramo, Caçador, Cristal, Pincel | 5 pedras dos tipos novos (pena, galho, lupa, cubo, gota de tinta) |
| Amuleto de XP | um pingente que dobra a experiência por um dia |
| Doce de amizade | um docinho em forma de coração |
| Ovo misterioso | um ovo com estampa de interrogações, de uma conquista rara |

### 2.4 Cartão de troca (opcional)

Para trocar acessórios ou mostrar o seu mon a um amigo, o app gera um **código curto**. Peça uma **moldura de cartão de troca** em 1200 × 630, com espaço para o mon, o nome, o tipo e o código, no mesmo estilo do cartão de treinador atual (`public/card.html`).

---

## 3. Formato de entrega

### Criaturas

| Item | Especificação |
| --- | --- |
| Formato | **SVG** (preferido, para os olhos piscarem) ou PNG com transparência, 1024 × 1024 px, sRGB |
| Enquadramento | criatura centralizada; **pés encostando na borda de baixo**; topo a ~4% da borda de cima |
| Nome | `<forma>[.shiny][.night][.region-<regiao>][@pose].svg` |

Exemplos:

```
docs-juvenile.svg         docs-adult.shiny.svg        docs-mythic.night.svg
git-adult@working.svg     debug-mythic.shiny@done.svg data-juvenile@sleep.svg
craft-juvenile.region-py.svg      lore-adult.region-rs@attention.svg
mergeon.svg               mergeon.shiny.svg           aeonbyte.night.svg
mark-js.svg  mark-py.svg  mark-rs.svg  mark-go.svg  mark-jvm.svg  mark-cs.svg
```

### Acessórios, itens e telas

```
wear/glasses-round.svg    wear/hardhat.svg     wear/tie.svg       (um arquivo por acessório)
items/stone-craft.svg     items/xp-charm.svg   items/mystery-egg.svg
ui/box-forest.png         ui/party.svg         ui/box.svg         ui/slot-empty.svg   ui/project-tag.svg
ui/aura-focus.svg         ui/trade-card.png
```

### Prioridade

| Fase | O quê | Quantidade |
| --- | --- | --- |
| **1** | 5 tipos novos, formas normais | 15 SVG |
| **1** | Marcas regionais + 6 exemplos | 6 marcas + 6 SVG |
| **1** | Time e Caixa: ícones, slot vazio, selo de projeto, 4 fundos | ~8 arquivos |
| **2** | Shiny, noturna e poses dos tipos novos | 15 + 15 + 75 SVG |
| **2** | 18 acessórios e 14 ícones de itens | 32 SVG |
| **3** | Lendários, evoluções por amizade, fundos restantes, cartão de troca | ~25 arquivos |

O app aceita entrega aos poucos: o que faltar continua com a arte atual ou gerada em código.

---

## 4. Checklist de qualidade

- [ ] Silhueta reconhecível a 64 px, mesmo preenchida de preto?
- [ ] Jovem → Adulto → Mítico crescem claramente em tamanho e em detalhes?
- [ ] Mesmo contorno e mesmo sombreamento das 22 formas atuais?
- [ ] Pupilas como elipses `class="k"`, espelhadas e na mesma altura (para piscar)?
- [ ] Fundo transparente, sem sombra no chão, pés na borda de baixo?
- [ ] Nenhum logo real de linguagem ou empresa, nada que lembre um Pokémon específico?
- [ ] Acessórios no ponto de encaixe certo (0,0) e na escala de 100 unidades?
- [ ] Ícones legíveis a 24 px?

## 5. Licença

- Gerado por IA: confira os termos da ferramenta para uso comercial.
- Com ilustrador: peça cessão de direitos ou licença CC BY 4.0, e os arquivos-fonte.
- O projeto é open source (MIT). A arte entra no repositório com o crédito de quem fez, no `art/official/pack.json`.
