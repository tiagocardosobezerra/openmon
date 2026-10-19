# Openmon: briefing de arte (logomarca + 22 Openmons)

Este documento serve para duas coisas:

- gerar a arte com IA (Midjourney, GPT Image, Ideogram, Flux…);
- passar para um ilustrador.

Os prompts estão em inglês porque os geradores entendem melhor. As instruções estão em português.

Quando a arte ficar pronta, ela entra no app sem mexer no código. Os formatos estão na seção 5.

---

## 1. Direção de arte (vale para tudo)

**Conceito.** Monstrinhos colecionáveis que vivem na área de trabalho e crescem com o trabalho de um agente de IA. Visual de "mascote de app fofo" com alma de criatura de RPG. São criaturas **originais**: nada de bolas de captura, nem cores, formas ou logos que lembrem criaturas de outras franquias.

**Estilo.**

- Chibi/kawaii, corpo arredondado, cabeça e corpo numa peça só (formato "bolinha").
- Contorno grosso e uniforme na cor `#2a2140` (roxo quase preto), com cerca de 3% da altura da figura.
- Sombreamento cel em 2 tons (cor base + 1 sombra) e 1 brilho suave no topo. Sem gradiente realista nem textura.
- Olhos grandes e brilhantes; bochechas rosadas (`#ff7f9f` a 55%).
- Bracinhos curtos tipo cotoco e dois pezinhos ovais.
- Vista frontal levemente 3/4, como um sticker.

**Regra de ouro.** Cada forma precisa ser reconhecível **só pela silhueta, a 64 px**. A evolução muda o formato do corpo, não só a cor.

### Bloco de estilo

Cole este bloco no fim de todo prompt de criatura:

```
original chibi creature mascot, kawaii, round squishy body, thick uniform dark outline (#2a2140),
flat cel shading with one soft highlight, big shiny eyes, rosy cheeks, tiny stubby arms, two small oval feet,
front three-quarter view, full body, centered, feet touching the bottom edge, sticker style,
clean vector look, transparent background, no text, no shadow on the ground, no background,
consistent with a cute desktop pet game, readable at small sizes
--no capture ball, franchise characters, text, watermark, background, realistic, 3D render
```

### Paleta por linhagem

As cores são as mesmas do app. Use os códigos hex no prompt.

| Linhagem | Corpo | Sombra | Barriga | Detalhe | Brilho/aura |
| --- | --- | --- | --- | --- | --- |
| Ovo | `#fff4e0` | `#efd9b4` | — | manchas `#f2b880` | — |
| Sprout | `#f6e7c9` | `#dcc59c` | `#fff8ea` | folha `#78c86b` | `#fff3d1` |
| Craft (forja) | `#ff9f43` | `#d9762b` | `#ffe2bd` | chifres `#7a5440`, metal `#9aa3b5` | `#ffc56e` |
| Lore (saber) | `#9381f2` | `#6c5bcf` | `#e6e0ff` | dourado `#f5d35f` | `#c7baff` |
| Shell (terminal) | `#35d0bf` | `#1fa496` | `#d5fff8` | luz amarela `#ffe156` | `#9dfff2` |
| Test (teste) | `#74cc63` | `#4e9f42` | `#e4f8d8` | casco `#3f7d4f`, ouro `#f4d35e` | `#c3ffa8` |
| Roam (viagem) | `#5fb3ff` | `#3d88d8` | `#e0f1ff` | asas brancas, cachecol `#ff8a5c` | `#b5e0ff` |
| Swarm (enxame) | `#ff80b8` | `#e0579b` | `#ffe3f0` | bolinhas `#ffd166` | `#ffbddb` |
| Chimera (oculta) | `#b9a6ff` | `#8b74e6` | `#fff0fb` | ouro `#ffd166`, menta `#5fd4c4` | `#ffd6f5` |

**Shiny** (variante rara de cor, mesma forma):

| Linhagem | Corpo | Detalhe |
| --- | --- | --- |
| Sprout | azul-gelo `#dff1ff` | folha rosa `#ff8fb8` |
| Craft | aço `#5d6d8f` | chifres dourados `#e9c46a` |
| Lore | dourado `#f2c14e` | roxo `#7e5bd6` |
| Shell | rosa `#ff6b8a` | luz verde `#7dffb0` |
| Test | azul-noite `#41476a` | casco dourado `#e2b13c` |
| Roam | amarelo `#ffd36b` | — |
| Swarm | menta `#7ce3b5` | — |

**Nocturne** (evoluiu de madrugada): a mesma cor puxada para o azul-meia-noite `#2b2f6b`, barriga `#c9d4ff`, brilho `#a9dcff` e uma lua crescente amarela na testa.

### Olhos por linhagem (a partir do Adult)

| Linhagem | Olhos |
| --- | --- |
| Craft | determinados, com a pálpebra superior reta e inclinada |
| Lore | de coruja: esclera branca grande e pupila redonda |
| Shell | de gato: oval vertical estreita e pálpebra pontuda |
| Test | gentis: pálpebra caída em arco |
| Roam | de anime: metade de baixo da íris azul clara e um brilho em estrela |
| Swarm | miçangas pequenas e redondas |
| Chimera | heterocromia: cada olho no estilo de uma das duas linhagens |

---

## 2. Logomarca

**Ideia.** Um ovo rachando, com um pequeno Openmon espiando pela rachadura. A rachadura forma um sinal de código, `>_` ou `</>`, e o ovo é a letra **O** de **Openmon**. Lê como "open" (open source), "mon" (criatura) e "monitor" (ele vigia seu agente).

**Cores da marca.**

| Uso | Cor |
| --- | --- |
| Tinta | `#2a2140` |
| Roxo principal | `#7c6cf2` |
| Amarelo de destaque | `#ffe156` |
| Vermelho Opendex | `#e5484d` |
| Creme | `#fffdf7` |

**Tipografia.** Arredondada e pesada, com licença livre (OFL): **Fredoka** (Bold), **Baloo 2** (ExtraBold) ou **Nunito** (Black).

### Prompt: símbolo (o ícone sozinho)

```
logo mark for "Openmon", a cute egg-shaped letter O cracking open at the top, a tiny round purple creature
with big shiny eyes peeking out of the crack, the crack forms a small ">_" code prompt shape,
flat vector, thick rounded dark outline #2a2140, colors #7c6cf2 purple, #ffe156 yellow, #fffdf7 cream,
simple geometric shapes, works at 16x16 pixels, centered, transparent background, no text,
app icon quality, friendly, playful, original --no capture ball, gradient, 3D, realistic
```

### Prompt: logotipo completo (símbolo + nome)

O Ideogram e o GPT Image escrevem texto melhor que os outros.

```
horizontal logo "Openmon", the first letter O is a cute cracked egg with a tiny purple creature peeking out,
rest of the word in a heavy rounded friendly font similar to Fredoka Bold, letters in dark ink #2a2140,
small yellow #ffe156 spark accents, flat vector, clean, generous spacing, transparent background,
playful developer tool brand, original creature-collector feel --no capture ball, franchise fonts, gradient, 3D
```

### Prompt: ícone do app (fundo quadrado arredondado)

```
app icon, rounded square with purple #7c6cf2 background, centered cute cracked egg with a tiny creature
peeking out, thick dark outline #2a2140, cream #fffdf7 egg, yellow #ffe156 spark, flat vector,
bold and simple, readable at 32x32, no text --no gradient, 3D, realistic
```

### Prompt: ícone da bandeja (16 px, monocromático)

```
minimal monochrome pixel-friendly icon of a cracked egg with two dot eyes peeking out,
solid dark #2a2140 silhouette on transparent background, designed for 16x16 system tray, no text, no details
```

**Dica.** Gere o símbolo primeiro. Depois peça o logotipo e o ícone usando o símbolo como imagem de referência (image prompt / `--cref` / "use this image as reference"), para que tudo combine.

---

## 3. Os 22 Openmons

### Como gerar com consistência

1. Gere o **Sprout** primeiro, até ficar perfeito. Ele é a referência de estilo de todos.
2. Para cada forma, use o Sprout como imagem de referência de estilo, monte o prompt da forma e cole o bloco de estilo no fim.
3. Mantenha a mesma *seed* ou o mesmo *style reference* em tudo.
4. Gere a forma normal primeiro. Depois peça a **shiny** e a **Nocturne** com "same character, recolor to…", usando a imagem normal como referência.
5. Revise as silhuetas lado a lado: Juvenile → Adult → Elder precisam crescer em tamanho e em detalhes.

### Molde de prompt

```
<DESCRIÇÃO DA FORMA>, color palette: body <hex>, shadow <hex>, belly <hex>, accents <hex>,
+ BLOCO DE ESTILO
```

### #001 Egg (`egg`)

```
a cute creature egg, smooth oval, cream #fff4e0 with soft peach #f2b880 spots, one small zigzag crack near the top,
glossy highlight, standing upright
```

Para a pose `@attention`, acrescente: "two big shiny eyes peeking through the crack".

### #002 Sprout (`sprout`)

```
small round newborn blob creature, cream #f6e7c9 body, lighter belly #fff8ea, a tiny two-leaf green sprout
#78c86b growing from the top of its head, big round black shiny eyes, rosy cheeks, small happy smile
```

### Linhagem Craft (forja)

Edições de código. Visual de ferreiro: chifres, óculos de proteção, brasas.

- **#003 Tinkit** (`craft-juvenile`)

  ```
  small round orange #ff9f43 blob creature, belly #ffe2bd, two short stubby brown horns #7a5440, curious round eyes
  ```

- **#004 Forgemaw** (`craft-adult`)

  ```
  chunky sturdy orange #ff9f43 blacksmith creature, longer curved brown horns #7a5440,
  steel goggles #9aa3b5 pushed up on its forehead, determined eyes with flat slanted upper lids,
  strong stubby arms, a short tail ending in a spade tip, belly #ffe2bd
  ```

- **#005 Archsmith** (`craft-mythic`)

  ```
  larger majestic orange #ff9f43 forge creature, curved horns, a small crown of three flames #ffe066 between the horns,
  steel goggles, glowing molten circuit lines on its body, warm ember aura #ffc56e, spade tail, determined proud eyes
  ```

### Linhagem Lore (saber)

Leitura e busca. Visual de coruja-sábia e pergaminho.

- **#006 Owlet** (`lore-juvenile`)

  ```
  small lavender #9381f2 teardrop-shaped creature, pointed owl ear tufts #6c5bcf, belly #e6e0ff, big curious eyes
  ```

- **#007 Scrollwyrm** (`lore-adult`)

  ```
  tall slender lavender #9381f2 serpentine creature, owl ear tufts, huge owl eyes with white sclera and round pupils,
  a long tail curled like a rolled scroll, belly #e6e0ff, scholarly
  ```

- **#008 Oracle** (`lore-mythic`)

  ```
  tall lavender #9381f2 mystic creature, golden third eye #f5d35f on its forehead, owl tufts, scroll tail,
  small glowing stars and floating pages orbiting it, soft violet aura #c7baff, serene owl eyes
  ```

### Linhagem Shell (terminal)

Comandos. Visual de bicho elétrico e caranguejo hacker.

- **#009 Sparkle** (`shell-juvenile`)

  ```
  small wide flat teal #35d0bf blob creature, one thin antenna with a glowing yellow #ffe156 bulb, belly #d5fff8
  ```

- **#010 Voltcrab** (`shell-adult`)

  ```
  wide low teal #35d0bf crab-like creature, two dark teal #1fa496 pincers, three little legs on each side,
  sharp cat-like eyes, antenna with glowing yellow bulb, belly #d5fff8, mischievous
  ```

- **#011 Kernel** (`shell-mythic`)

  ```
  large teal #35d0bf crab-like creature, two antennas with glowing bulbs, glowing circuit lines on its shell,
  pincers, crab legs, floating "</>" glyphs around it, cyan aura #9dfff2, confident cat eyes
  ```

### Linhagem Test (teste)

Rodar testes. Visual de tartaruga-guardiã e escudo.

- **#012 Shellby** (`test-juvenile`)

  ```
  small green #74cc63 turtle-like blob, dark green #3f7d4f dome shell on its back with a faint hexagon pattern,
  small crest on top, shy sweet eyes
  ```

- **#013 Bastion** (`test-adult`)

  ```
  sturdy green #74cc63 turtle guardian creature, big dark green #3f7d4f domed shell with hexagon pattern,
  kind droopy eyes with arched lids, a small crest, protective and calm
  ```

- **#014 Aegis** (`test-mythic`)

  ```
  large green #74cc63 turtle guardian, big hex-patterned shell, a floating ring of golden #f4d35e shield arcs around it,
  soft green aura #c3ffa8, kind wise eyes, heroic stance
  ```

### Linhagem Roam (viagem)

Web e ferramentas MCP. Visual de gota alada, peixe-pássaro e viajante.

- **#015 Wisp** (`roam-juvenile`)

  ```
  small sky blue #5fb3ff droplet-shaped creature with a pointed top, tiny white wings, a little swept tuft
  ```

- **#016 Skyfin** (`roam-adult`)

  ```
  sky blue #5fb3ff droplet-shaped flying creature, bigger white wings, a fish tail fin #3d88d8,
  sparkly anime eyes with light blue irises and star highlights, adventurous
  ```

- **#017 Wayfarer** (`roam-mythic`)

  ```
  large sky blue #5fb3ff winged traveler creature, huge white wings, fish tail fin, small orange #ff8a5c scarf,
  little star sparkles around it, light blue aura #b5e0ff, sparkly anime eyes
  ```

### Linhagem Swarm (enxame)

Subagentes. Visual de colmeia fofa com ajudantes.

- **#018 Mote** (`swarm-juvenile`)

  ```
  small round pink #ff80b8 blob creature, one bobble antenna with a yellow #ffd166 ball, belly #ffe3f0
  ```

- **#019 Hivekin** (`swarm-adult`)

  ```
  round pink #ff80b8 hive creature with three bobble antennae, small bead eyes,
  two tiny pink buddy blobs standing next to its feet, cheerful colony
  ```

- **#020 Legion** (`swarm-mythic`)

  ```
  larger pink #ff80b8 hive leader creature with a crown of four bobble antennae, four tiny buddy blobs around it
  (two standing, two floating), pink aura #ffbddb, proud bead eyes
  ```

### Linha oculta

Só aparece quando dois tipos de trabalho empatam.

- **#021 Chimera** (`chimera-adult`)

  ```
  lilac #b9a6ff hybrid creature combining features of two lineages (for example blacksmith horns and owl ear tufts),
  heterochromia (each eye a different style and color), mint #5fd4c4 and gold #ffd166 accents, mysterious
  ```

- **#022 Paragon** (`chimera-mythic`)

  ```
  larger lilac #b9a6ff legendary hybrid creature, features of two lineages, heterochromia,
  a glowing infinity symbol halo above its head, pink aura #ffd6f5, perfectly balanced, regal
  ```

**Observação sobre a Chimera.** O app combina duas linhagens quaisquer. Para a arte, gere uma versão "neutra" (chifres + tufos, por exemplo). Se quiser ir além, gere uma versão para cada par que você mais gosta.

### Poses (opcional, dá muita personalidade)

| Arquivo | Como desenhar |
| --- | --- |
| `@sleep` | olhos fechados em arco, corpo levemente achatado, sorriso tranquilo |
| `@working` | olhar concentrado para baixo e para frente, sobrancelha determinada |
| `@attention` | olhos arregalados, boca em "o", bracinhos para cima, sobrancelhas levantadas |
| `@error` | olhos em `> <`, boca ondulada, sobrancelhas preocupadas, gotinha de suor opcional |
| `@done` | olhos felizes `^ ^`, sorriso aberto, bracinhos para cima |

**Importante.** **Não** desenhe placa "!", martelo, livro, escudo, luneta, "Zzz", confete, corações nem a aura dos estágios comuns. O app desenha tudo isso por cima e anima. Desenhe só a criatura.

---

## 4. Checklist de qualidade (seja crítico)

- [ ] Silhueta reconhecível a 64 px, mesmo preenchida de preto?
- [ ] Juvenile → Adult → Elder crescem claramente em tamanho e em detalhes?
- [ ] Contorno com a mesma espessura em todas as 22 formas?
- [ ] Fundo 100% transparente, sem sombra no chão e sem borda branca de recorte?
- [ ] Pés tocando a base da imagem?
- [ ] Nada que lembre criaturas de outras franquias?
- [ ] As shiny são a mesma forma, só com outra cor?
- [ ] Os olhos seguem o estilo da linhagem a partir do Adult?

---

## 5. Formato de entrega (para entrar no app)

### Criaturas: `~/.openmon/art/`

Rode `openmon art` para ver a pasta exata e a lista de nomes.

| Item | Especificação |
| --- | --- |
| Formato | **PNG** com transparência (ou **SVG**, ainda melhor; **WebP** também serve) |
| Tamanho | **1024 × 1024 px**, sRGB |
| Enquadramento | criatura centralizada na horizontal; **pés encostando na borda de baixo** (margem de até 2%); topo da cabeça/coroa/asas a ~4% da borda de cima |
| Escala | ocupe a altura toda em todas as formas; o app reduz Egg e Sprout sozinho |
| Nome do arquivo | `<forma>[.shiny][@pose].png` |

Exemplos de nome:

```
egg.png                 sprout.png               sprout.shiny.png
craft-juvenile.png      craft-adult.png          craft-mythic.png
craft-adult.shiny.png   craft-adult@sleep.png    craft-adult.shiny@done.png
lore-juvenile.png  …    swarm-mythic.png
chimera-adult.png       chimera-mythic.png
```

**Pacote mínimo:** 22 PNGs (as formas normais).
**Pacote completo:** 22 normais + 21 shiny (o ovo não tem shiny) + até 5 poses por forma.

Se alguma forma faltar, o app usa a arte desenhada em código, então dá para entregar aos poucos.

Opcionalmente, coloque um `pack.json` na mesma pasta:

```json
{ "name": "Openmon Official", "author": "Seu Nome", "license": "CC BY 4.0", "scale": 1.0 }
```

### Marca: `agent-pet/assets/brand/`

Mande estes arquivos e eu ligo no app (bandeja, ícone, Opendex, cartão de treinador, README):

| Arquivo | Uso |
| --- | --- |
| `logo-mark.svg` + `logo-mark-1024.png` | símbolo sozinho, fundo transparente |
| `logo-full.svg` + `logo-full-2048x640.png` | logotipo horizontal (símbolo + "Openmon") |
| `logo-full-white.svg` | versão para fundo escuro |
| `app-icon-1024.png` | ícone do app (quadrado arredondado com fundo) |
| `tray-16.png`, `tray-32.png` | ícone da bandeja, silhueta simples (e `tray-template.png` em preto para macOS) |
| `favicon.ico` | 16, 32 e 48 px |
| `social-1200x630.png` | imagem de compartilhamento do repositório e do README |

SVG com as fontes **convertidas em contorno**, para não depender da fonte instalada.

---

## 6. Licença e uso

- Gerado por IA: confira os termos da ferramenta para uso comercial. Midjourney e GPT Image permitem nos planos pagos.
- Com ilustrador: peça cessão de direitos (ou licença CC BY 4.0) e os arquivos-fonte (`.ai`, `.fig`, `.psd` ou `.svg`).
- Registre no `pack.json` quem fez a arte. Os créditos aparecem no projeto.
