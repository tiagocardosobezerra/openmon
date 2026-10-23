# Art packs

Openmon ships with official vector art (`art/official`) and can still draw every form in code (`OPENMON_CLASSIC=1`). An art pack replaces the official images with your own, one file per form, without touching the code. This is how an artist gives Openmon a hand-drawn look.

## Where

Put the images in `~/.openmon/art/` (run `openmon art` to print the exact folder and the full list of names). Restart the pet, or reload the Opendex, to see them.

## File names

`<form>[.shiny|.night|.<variant>][@<pose>].<png|svg|webp>`

| Part | Values |
| --- | --- |
| `<form>` | `egg`, `<lineage>-<stage>` or a legendary (`mergeon`, `aeonbyte`, `zeroday`): lineages `craft`, `lore`, `shell`, `test`, `roam`, `swarm`, `docs`, `git`, `debug`, `data`, `style`, `chimera`; stages `juvenile`, `adult`, `mythic` (Chimera has only `adult` and `mythic`) |
| `.shiny` | optional, the rare colour variant |
| `.night` | optional, the Nocturne colours |
| `.<variant>` | optional: `.friend` (the friendship Elder), `.craft-lore` and the other 14 pairs on `chimera-adult`, `.region-<js\|py\|rs\|go\|jvm\|cs>` |
| `@<pose>` | optional: `sleep`, `working`, `attention`, `error`, `done` |

Examples: `craft-adult.png`, `craft-adult.shiny.png`, `craft-adult@sleep.png`, `chimera-mythic.svg`.

Lookup order for a shiny Forgemaw asleep: `craft-adult.shiny@sleep`, `craft-adult.shiny`, `craft-adult@sleep`, `craft-adult`, then the built-in art. A pack does not need to cover every form or pose: anything missing falls back to the official art, then to the built-in drawing. Nocturne art uses `.night` (`craft-adult.night.svg`); without it the image is tinted toward midnight blue.

### Poses in every colour

Draw the poses once, in the normal colours. `node tools/build-tints.js` compares each `.shiny`, `.night`, `.friend` and Chimera pair with its normal form and writes `tints.json` next to the art: which colours change, the white ring night pupils get, and what the variant adds (the night moon, the friendship bow). The pet applies that to every pose at draw time, so a shiny or night Openmon still sleeps, works and cheers in its own colours. Shiny art needs no sparkles: the pet draws the glow and stars on every shiny.

### Accessories and items

Accessories are SVGs in `public/wear/<id>.svg`, each in its own frame: a hat's base at 0,0 on a head 100 units wide, neckwear centred on the neck line of a body 100 wide, glasses centred between two eyes 40 units apart. The pet places them from each form's outline and eyes. Item icons are 40 × 40 SVGs in `public/items/`.

## Drawing guidelines

- Transparent background, the creature centred horizontally, feet on the bottom edge.
- Any size; 512 px tall is a good master. The pet scales it to the stage's height (eggs and babies are smaller than elders).
- A dark outline (about 2–3 % of the height) keeps it readable on any wallpaper.
- Motion is added for you: breathing, hops, squash and stretch, the spin, shaking on errors. Props (the "!" sign, hammer, book, shield…) and particles are drawn on top. Leave a little room on the right for the sign.
- Pose images are where the personality goes: closed eyes for `sleep`, a surprised face for `attention`, a grin for `done`.

## pack.json (optional)

```json
{ "name": "Watercolour", "author": "Your Name", "license": "CC BY 4.0", "scale": 1.1 }
```

`scale` makes every image bigger or smaller than the default height.

## Safety

Only files whose names match the pattern above are listed or served, and SVGs are served with a policy that blocks scripts.
