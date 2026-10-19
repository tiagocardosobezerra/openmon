# Review log: seven critique-and-fix cycles

Each cycle looks at the product through one lens (game design, character appeal, UI/UX, the core utility), lists what is wrong without excuses, picks the fixes worth making, ships them and checks them.

## Cycle 1: first-run experience

**Critique**
- A new user sees a silent egg and no explanation. Nothing says what feeds it or how long it takes. Most people would close it in a minute.
- If the hooks are not installed, the egg sleeps forever and gives no hint why. This is the most likely failure, and it was invisible.
- Clicking the egg did nothing visible except hearts. In every pet game, the egg reacts when you touch it.
- After hatching we told people to run `openmon name <name>` in a terminal. Pokémon asks for the nickname right there. Our window cannot take keyboard focus, so there was no way to do it in place.
- The hover card said "30 to go": to go where?

**Shipped**
- A brand-new egg introduces itself once: "Hi! I hatch when your agent works."
- When Claude Code is not connected and no session is live, a blue bubble says so and shows the exact command (`openmon install`). The daemon re-checks the hooks every 10 s, so the bubble goes away by itself.
- Petting the egg makes it wobble, look happy and knock back with its own sound.
- "Name…" in the right-click menu opens a small focused window with the current name selected. The hatch message now points to it.
- The card says "hatches in 12", "340 to evolve" or "needs bond 60".
- Tests no longer read the real `~/.claude/settings.json`.

**Checked**: fresh egg in the browser shows the intro bubble; name window renders and preselects the name; 39 tests pass.

## Cycle 2: character appeal

**Critique**
- Every one of the 18 forms had the same face: same eyes, same mouth. Pokémon and Digimon sell species through faces. Ours were recolours with hats.
- No eyebrows, so "error", "needs you" and "working" all read the same at 40 px.
- The pet ignored you. It never looked at your cursor, even while you hovered it.
- Idle was a loop of breathing. Real virtual pets have small surprise acts that make you smile.
- Hivekin's buddies sat on its head and read as mouse ears.

**Shipped**
- Lineage eyes from Adult on: fierce (Craft), owl (Lore), cat (Shell), kind (Test), sparkly anime eyes with a coloured iris (Roam), beads (Swarm).
- Eyebrows: determined while editing, running commands or testing; raised when it needs you; worried on errors.
- Cheeks blush harder when it is happy or petted.
- Its eyes follow your cursor while the cursor is near, and it beams when you hover it.
- Idle acts: a big stretch every half minute or so, a little spin-hop now and then.
- Hivekin and Legion buddies stand beside it on the ground.

**Checked**: rendered six adult/mythic forms in their poses side by side; faces are now distinct at a glance.

## Interlude: the name

The project is now **Openmon**, and its field guide is the **Opendex**. "Open" says open source, "mon" says creature-collector at a glance, and it doubles as "open monitor", which is exactly what the pet does for your agent. Renamed everywhere: package and CLI (`openmon`), data folder (`~/.openmon`, an old `~/.bytelings` is moved over automatically), environment variables (`OPENMON_HOME`, `OPENMON_PORT`), and hooks (installing replaces hooks left under the old name).

## Cycle 3: game feel

**Critique**
- Progress was one abstract bar per stage. Between evolutions (hundreds or thousands of XP) nothing ticked up. Pokémon players expect a level number that keeps moving.
- Nothing warned that an evolution was close, so it landed out of nowhere. Digimon builds tension before a digivolution.
- Players could not tell which way their pet was heading, so the stat system was invisible.
- I shipped a renderer bug in this cycle (a variable used before it was declared) that blanked the hover card. The front end has no automated test; browser checks after every cycle are mandatory.

**Shipped**
- Levels 1–100 on a Pokémon-like curve: about Lv 9 at the first evolution, Lv 25 at Adult, Lv 55 at Mythic, Lv 100 at 49,005 XP. Every level-up shows a gold "Lv 12!" with a jingle.
- At 90% of the way to the next stage, the pet pulses with light (the egg rocks harder), and the card says "Ready to evolve soon!" or "About to hatch!".
- The card says which stat it is leaning towards, without spoiling the form.

**Checked**: 41 tests (level curve and level-up event included); card renders Lv, dex number, leaning and nature with no console errors.

## Cycle 4: UI and UX

**Critique**
- **Safety bug.** Permission bubbles cut commands at the last slash: `rm -rf ./build && npm run deploy` showed as `build && npm run deploy`. The one thing the user must read before approving was mangled.
- The hover card opened on top of the evolution scene and hid it.
- The stats grid showed raw counts ("Roam 28") that do not decide anything. The weighted affinity that does decide the lineage was invisible.
- The "×2" badge was cryptic, and it sat on top of the bubble and the card.
- Long permission texts were cut to one line; 11 px text was too small on high-DPI screens.
- The whole canvas showed a grab cursor, even on empty space.
- No respect for the OS "reduce motion" setting: jumping, shaking and confetti for everyone.
- An egg's card showed six empty stat bars.

**Shipped**
- Commands are shown as typed, up to 90 characters, in a two-line bubble. Covered by a test.
- The card never covers an evolution or a scene message.
- Stats are affinity bars in each lineage's colour; the leading one is bold; raw counts are in the tooltip. Eggs hide them.
- Badge reads "2 agents" and sits at the pet's feet, yellow when one is waiting.
- 12 px minimum in the card and bubbles.
- Grab cursor only over the pet.
- With reduced motion: small hops, no shake, no spin, few particles, no bubble wobble.

**Checked**: two simulated sessions, one waiting on a long `rm -rf` command; 42 tests pass.

## Cycle 5: meta-game

**Critique**
- Every form was predictable from the stats. No secret, so nothing for players to trade tips about. Pokémon spreads through rumours ("Mew is under the truck").
- Badges only ever appeared as a toast for four seconds. You could not see what you had earned or what was left.
- The Opendex had 20 entries you could fill in a month and then forget.

**Shipped**
- A hidden line: **Chimera** (#021) and **Paragon** (#022). It appears only when the top two kinds of work are tied within 4 points of affinity, both above 20%. The form wears both lineages at once: both shapes' features, and heterochromia (one eye from each lineage). Undiscovered, the Opendex shows it as "Hidden form" with a hint ("some say balance is the key").
- A secret badge, "Who's that Openmon?", unlocked by finding a hidden form. Shown as "???" until earned.
- The Opendex has a Badges panel: earned badges with the date, locked ones greyed, secret ones hidden.

**Checked**: a tie test (Craft 300 vs Test 300) grows a Chimera and unlocks the secret badge; three Chimera combinations rendered; 43 tests pass.

## Cycle 6: the core job (telling you when the agent needs you)

**Critique**
- **The worst bug of the review.** Claude Code sends an `idle_prompt` notification about a minute after every finished turn. We treated it as "needs you": the pet jumped, held up the sign and chimed after every single answer. That is crying wolf, and users learn to ignore the one signal that matters.
- A permission burst (five prompts in a row) chimed five times.
- When two agents waited, the bubble said "2 agents need you" but not which ones.
- There was no way to tell the pet "I saw it". It kept jumping until the agent moved.
- The "done ✓" bubble stayed for 10 minutes and became wallpaper.

**Shipped**
- `idle_prompt` now only keeps the session in "done". Only permission prompts and real questions raise the alarm. Covered by a test.
- At most one chime every 20 s.
- Several waiting agents are listed by name.
- Clicking the pet while it waits means "seen": it stops jumping and holds the sign up calmly. The OS notification and bond logic are unchanged.
- "Done ✓" shows for 90 s, then the pet just looks pleased.

**Checked**: two simulated permission waits show both names; a click calms the pet; 44 tests pass.

## Cycle 7: performance, sharing, honesty

**Critique**
- The pet redrew 60 times a second all day, asleep or not, in an always-on-top window. A desktop companion that eats battery gets uninstalled.
- The trainer card ignored shinies (normal colours behind a shiny pet), and did not show the level, the number players compare first.
- The front end still has no automated test. Two renderer bugs in this review were only caught by looking.

**Shipped**
- Adaptive frame rate: 60 fps while something happens (work, alarms, effects, hover), 30 when idle, 12 asleep, 0 when the window is hidden. Measured in the browser: 30 draws/s when idle, down from 60.
- Trainer card: shiny palette and a "SHINY" tag, Lv in the header, Chimera colours.
- README and design doc updated for everything above.

**Still weak, on purpose left for next**
- Art: procedural and charming, but a hand-drawn pass by a real artist is what makes a creature collector sell.
- Renderer smoke tests (load the page headless, fail on any console error) belong in CI.
- Sounds and timings were checked by code, not by ear.

**Checked**: 44 tests pass; no console errors on the pet page, the Opendex or the trainer card.

## After the review: closing the open items

- **Renderer smoke test** (`npm run smoke`): every page in a hidden Electron window, the demo played at 4×, both languages; fails on any console error, crash, failed load or blank canvas. Proven by planting a broken script: the run failed on it.
- **Content-Security-Policy** on every page (the smoke test surfaced Electron's warning); art files are served with scripts blocked.
- **Art packs**: images in `~/.openmon/art` replace the procedural art per form, shiny and pose; motion, props and effects still apply. `openmon art` lists the names; `docs/ART-PACKS.md` is the artist's brief.
- **Nocturne**: evolving between midnight and 5 am gives midnight-blue colours and a crescent; a secret badge; a ☾ on Opendex entries seen at night.
- **Brazilian Portuguese**: bubbles, scenes, chatter, card, Opendex, trainer card, name window, tray menu, OS notification, and the game data (stats, natures, badges, field notes).
- **`openmon autostart on|off|status`**, plus software rendering and quit logging after the pet was found closed without a trace.

## Ready for evaluation

- **Playground** (`openmon playground`): a sandbox pet with its own save and a control panel to reach every form, scene and state in minutes. Its actions exist only on the playground daemon; the real pet's daemon refuses them.
- **Supervisor**: the pet was found closed twice after a Chromium utility (network) process crashed on this machine. `openmon start` now restarts it if it exits without a quit request; an intentional `openmon stop` or "Quit" stays stopped. Both checked by killing the process and by stopping it.
- 48 unit tests and the smoke test (8 pages, including the playground) pass.

## Official art and brand

- The art handoff (one HTML presentation) was turned into files: 35 SVGs in `art/official`, tightly framed (feet on the bottom edge), now the default look. A user pack still overrides it per file; `OPENMON_CLASSIC=1` brings back the code-drawn art.
- Fixed from the review: baked-in auras removed (the app draws its own); **Bastion** became a fortress (merlons, gold trim, shield crest, sturdy legs, tail) and **Aegis** follows it; **Hivekin** and **Legion** became woven beehives with honeycomb cells, and their buddies became little winged bees.
- **Logo**: the wordmark is rebuilt with Fredoka Bold converted to outlines (no font needed). The egg now sits on the baseline at cap height, and on light backgrounds it is drawn in the letters' ink with a yellow `>_`, so it reads as the capital O even at 44 px.
- **Icons**: `npm run brand` renders the tray icons (purple egg with a cream rim, visible on light and dark taskbars; a template image on macOS), app icon PNG/ICO and favicon from the SVGs. The tray, windows, Opendex header, trainer card, pages and README use them.

## Completing the art set

- **Shiny for every form** (21): colour maps learned from the designer's own adult shinies and applied to the other stages of each lineage; Chimera gets mint and pink.
- **Nocturne for every evolved form** (21): darker midnight hues that keep a hint of the lineage colour, moonlit belly and highlights, softly glowing eyes and a yellow crescent on the forehead. The crescent in the designer's Sprout file had zero area (only its outline showed); fixed.
- **Five poses for every form** (105): sleep, working, attention, error and done, built in the designer's face language from the Sprout examples (closed arcs, ^ ^, raised brows with round eyes, > < with a sweat drop, determined brows looking down). Owls keep their beak.
- 169 SVGs in `art/official`. All generated files can be replaced one by one by hand-drawn ones.
- Follow-up polish: the attention and working poses now keep each lineage's own eyes (owl, cat, anime sparkle, fierce lids, and the Chimera's heterochromia), enlarged under raised brows or looking down at the work. The Nocturne moon now finds a clear spot: the forehead when free, otherwise a moon mark on the belly (Forgemaw, Archsmith, Scrollwyrm, Oracle); on the Shell crabs, the antenna bulb itself turns into the moon.

## Package 1: lineage powers and the waiting counter

- Evolution now unlocks real tools. Six powers, one per lineage (Forge log, Reading list, Command log, Test tracker, Travel log, Hive view), built from the hook payloads per session, in memory only. Locked powers show the lineage's silhouette and how to earn it.
- Waiting counter: time agents waited for you today (and lifetime), number of waits, fastest answer; live timer in the "needs you" bubble and on the powers page.
- The default pet name is now "Openmon" (it was "Byte", left over from the old name); pets still called "Byte" are renamed on load, chosen names are kept.
- Every icon (tray, app, windows, favicon, pages) is now the cracked egg.
- Playground: "Agent work burst" and "Unlock all powers" to try them in seconds.

# Round 2: seven more cycles

1. **Turn recap.** "Done ✓" said nothing about what happened. Now each turn is tracked (files, edits, commands, failures, green/red tests, reads, web, subagents, time) and the bubble shows a one-line recap; the powers page shows the last turn per session.
2. **Settings that last, quiet mode.** Sounds, chatter and notification switches were in memory and reset on every restart. They now live in `~/.openmon/config.json`. Quiet mode (30 min, 1 h, until tomorrow) silences sounds, chatter and OS notifications without hiding anything.
3. **Privacy.** Commands with secrets (API keys, tokens, passwords, Bearer headers, user:pass URLs, known key formats such as sk-, ghp_, AKIA, JWTs) appeared verbatim in bubbles, notifications and the powers. Everything is masked before it is cut or shown. Covered by tests.
4. **Daily missions.** A reason to come back each day that rewards useful habits: three missions a day from a pool of six, +25 XP and +2 bond each, +50 XP for a perfect day, shown on the card with progress.
5. **Menu and size.** The menu was a flat list of 18 items. Now: views first, then Quiet mode, Size and Settings submenus, Quit last. The pet comes in three sizes that grow or shrink around the corner it stands on.
6. **Long waits.** A wait that goes past two minutes gets one more chime and a stronger nudge, and the tray icon shows a "!" badge with the project name in its tooltip while any agent waits.
7. **Final pass.** The stats card got longer with missions and needed scrolling; it was reordered (level, XP and bond first, then missions, sessions, stats), missions were made one line each, and the window grew to 560 px (click-through outside the pet). Tests, smoke test and docs updated.

# Round 3: UI and UX overhaul

- One UI kit (`public/ui.css`: tokens, light and dark, Fredoka) and one top bar for every page. The card opens with a right-click and stays until closed; tabs (Agents, Today, Stats); Powers, Opendex and Bag one click away; a gear for the settings.
- Click to answer: the pet, its bubble, a session row and the OS notification bring the agent's window (terminal, VS Code, the Claude app) to the front. The hook finds that window once per session by walking up its process tree (`src/focus.js`).
- Bubbles look like the card (icon, session name, title, detail, action) and hide once you act on them. Pages open in one app window, in front of other apps.
- Pets go by their species name until you give a nickname, like Pokémon. The Opendex has a type chart and entries with how to get each form; stats explain how to train them.

# Round 4: ten cycles as a game, UI and UX reviewer

1. **The art is alive.** The SVG art ignored blinks and glances (the face was code-only). Eye variants (closed, happy, eight look directions) are now generated from each SVG's own pupils; idle breathing, sway, glances and a wiggle.
2. **Backups.** A formatted PC meant a new egg. Snapshots go to Documents/Openmon Backups (OneDrive-synced on Windows): daily files for 14 days plus `latest`, every 10 minutes of use and at every evolution. A fresh install offers to bring the pet back; a declined offer keeps the found pet aside. Export, import and CLI commands.
3. **Accessories.** 12 hats and neckwear unlocked by feats, kept across generations, drawn in ink style and placed from each sprite's outline and eye line.
4. **Items and the Bag.** Snacks (+2 bond, one per mission), Rare candy (one level, one per perfect day), the Everstone (stops evolving). A Bag page with previews on your own pet.
5. **Reactions.** It strolls a few steps when idle and shows emotes (? ♥ ♪ … !?) in character when the cursor rests near it, after a turn and after a snack.
6. **Pokémon moments.** A nickname prompt at hatch, a daily gift, streaks with a candy every 7 days.
7. **Journal.** One line per day for 60 days: work by kind, projects, tests, turns, waits. A 14-day chart on the Powers page with a week in numbers.
8. **First run.** Connect Claude Code from the pet's own bubble; two tips shown once (right-click for the card, click the sign to jump to the agent).
9. **Polish.** Visible keyboard focus, window titles in your language, a "Walk around" switch, emotes follow Chatter and quiet mode.
10. **Review.** A declined restore no longer risks the found pet; an older pet that unlocks many accessories at once gets one toast instead of a flood. Tests (76), smoke test and docs updated.

# Round 5: ten cycles as someone who does not play games

1. **No jargon.** Bond became Friendship, lineage became type, tool calls became agent actions, turns became requests, the Stats tab became Work, nature became personality, Nocturne became night colours, "Lv" became "Level" in Portuguese.
2. **A help page.** "How it works": each pose drawn live with what it means, what you can do, and the questions people ask (speed, privacy, quiet, hiding, reinstalling, removing).
3. **The card in plain words.** The XP and Friendship bars explain themselves on hover; label and value sit above a full-width bar, so long values never squeeze it.
4. **What the agent asks, in everyday words.** "Wants permission to run a command: npm publish", "Editing the file app.js", "Opening example.com".
5. **Menu.** Nickname…, Chatter and emotes, Connect to Claude Code, Make a copy now, Export my pet to a file…, Bring back a pet from a file….
6. **Empty states that guide.** No agents: what to do and what will appear.
7. **Numbers with units.** "11,998 XP to evolve", "4/100" friendship, level with a hint.
8. **Newcomers.** After the nickname question, one tip says where the help is.
9. **Pages explain themselves.** Window titles in your language; every page opens with what it is for.
10. **Review.** The card now draws again once names load (it could show raw ids for a moment). Tests and smoke test pass.
