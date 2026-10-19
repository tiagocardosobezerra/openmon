# Openmon: product design

> A desktop pet that lives on top of your screen and grows from the work your AI coding agent does.
> It tells you, from the corner of your eye, when the agent needs you, when it is done and when it broke something.

## 1. Why this can go mainstream

OpenWhip proved that people share agent toys. It also showed why most of them die in a month: the joke is the whole product, and the product makes the agent worse.

Openmon starts from a real, growing pain:

- Agents take minutes per task. You switch windows, and you miss the moment the agent stops to ask for permission. The agent sits idle, waiting for you.
- People now run several agents at once. Nobody can watch five terminals.

So the pet is first an **ambient status light with a face**, and second a **creature you raise**. The utility keeps it installed on day 30. The creature makes people talk about it on day 1.

Design rules that follow from this:

1. **Never get in the agent's way.** Official hooks only, `async: true`, the hook prints nothing and always exits 0. No fake keystrokes.
2. **Never get in your way.** Small window, draggable, remembers its place, hides from screen share on one click, silent by default except for the "needs you" chime.
3. **No guilt mechanics.** The pet never dies, never gets sick, never loses progress. Missing a day costs nothing. Care is rewarded, neglect is not punished.
4. **Reward what is good for the user anyway.** The pet bonds with you when you unblock your agent quickly. Green tests make it stronger. The game pushes you toward the habits that make you faster.
5. **Local and private.** No network beyond `127.0.0.1`, no telemetry, no account. State is one JSON file you own.
6. **Agent-agnostic core.** Claude Code first; Codex, Gemini CLI, Cursor and others are adapters that send the same signals.

## 2. The ambient layer (utility)

The pet's pose always shows the most important thing happening across all sessions:

| Priority | Agent state | Pet does | Ends when |
| --- | --- | --- | --- |
| 1 | Needs you (permission prompt, question, idle prompt) | Jumps, holds a "!" sign, shows the session name and message. Optional chime; OS notification if you have not reacted after 20 s. | You answer (next tool call or prompt in that session) |
| 2 | Hit an error (tool failed, API error) | Winces, sweat drop, short "ouch" bubble | Next successful step |
| 3 | Finished its turn | Celebrates, then sits with a "✓ done" bubble | You send the next prompt, or 10 min pass |
| 4 | Working | Animated action that matches the tool (below) | State changes |
| 5 | Nothing running | Idles, wanders a little, falls asleep after 5 min | Any event |

Working animations, one per tool family:

| Tool family | Claude Code tools | Pet action |
| --- | --- | --- |
| Craft | Edit, Write, MultiEdit, NotebookEdit | Hammering, sparks |
| Lore | Read, Grep, Glob, LS | Reading a book, eyes scanning |
| Shell | Bash (non-test) | Tapping a tiny terminal |
| Test | Bash running a test command | Holding up a shield; flashes green or red on the result |
| Roam | WebFetch, WebSearch | Looking through a spyglass |
| Swarm | Task / Agent, subagents | Tiny helper motes orbit it, one per running subagent |
| Memory | PreCompact | Munching (it "digests" the context) |

Several sessions: a small counter badge shows how many agents are working. Hovering shows a list: project name, state, last action. The pose follows the most urgent session.

## 3. The creature layer (retention)

### Stats

Every finished tool call adds 1 point to one of six stats, by tool family: **Craft, Lore, Shell, Test, Roam, Swarm**. A green test run adds 3 Test. The stats are the pet's personality and decide what it evolves into. Your pet ends up reflecting how you and your agent work.

### XP

| Event | XP |
| --- | --- |
| Tool call finished | 1 |
| Tool call failed | 1 (you still learn something) |
| Test run green | 5 |
| Agent turn finished | 3 |
| You answered a "needs you" within 30 s | 2 |
| Petting (click) | 0 XP, +bond |

XP is capped at 120 per rolling 10 minutes, so a runaway loop does not fast-forward the pet. This also makes progress predictable: about one evolution per natural milestone.

### Bond

Bond (0 to 100) is the care meter, and it only goes up:

- +2 when you answer a "needs you" within 30 s, +1 within 2 min.
- +1 per petting, at most 5 per day.
- +1 per day you use it (not cumulative; no streak to lose).

Bond unlocks the final stage and cosmetic reactions (hearts, small gifts).

### Stages

| Stage | Reached at | Form decided by |
| --- | --- | --- |
| Egg | start | — |
| Sprout | 30 XP (inside your first real session) | — |
| Juvenile | 400 XP (about a day) | Top stat at that moment |
| Adult | 3 000 XP (about a week) | Top stat at that moment (a lineage switch is possible) |
| Elder | 15 000 XP and bond ≥ 60 (about a month) | Top stat, plus the second stat as a trait |

Six lineages times three evolved stages give 18 forms, plus egg and sprout. The second-highest stat adds a visible trait (an accessory) from Adult on, so two Craft pets rarely look the same.

| Lineage (top stat) | Juvenile | Adult | Elder |
| --- | --- | --- | --- |
| Craft | Tinkit | Forgemaw | Archsmith |
| Lore | Owlet | Scrollwyrm | Oracle |
| Shell | Sparkle | Voltcrab | Kernel |
| Test | Shellby | Bastion | Aegis |
| Roam | Wisp | Skyfin | Wayfarer |
| Swarm | Mote | Hivekin | Legion |

Evolution is an event: the pet glows, shakes, flashes and reveals the new form, and a share card is generated (name, form, stats radar, days together). That card is the viral loop.

### Achievements

Small, honest milestones: first hatch, first green test, 100 green test runs, 1 000 edits, an agent that ran 50 tools in one turn, five agents at once, a night owl session, "quick hands" (10 fast answers in one day). Each one shows a toast once and lives on the profile.

### Classic game ideas we use

| Idea | Genre | In Openmon |
| --- | --- | --- |
| Branching evolution decided by how you raise it | virtual pets | Lineage from weighted stat affinity, re-checked at every stage |
| Silhouettes for unseen entries, numbered dex | creature games | Opendex #001–#022 with field notes and badges |
| Levels | creature games | Lv 1–100, square-root curve |
| Hidden forms, rumours | creature games | Chimera and Paragon, only on a near-perfect tie between two kinds of work |
| A glow before evolving | virtual pets | Pulse at 90% of the way to the next stage |
| Shiny variants | creature games | 1 in 128, decided at birth, revealed at hatch |
| Natures | creature games | Six natures that change idle behaviour and chatter |
| Species cries | creature games | A synthesised call per lineage, deeper as it grows |
| "What? X is evolving!" scene | creature games | Dim, flicker, reveal, fanfare, cry, dex entry |
| Friendship-gated evolution | creature games | Elder needs bond 60 |
| Rebirth into a new egg | virtual pets | Retire an Elder to the Hall of Fame; the egg inherits 10% of the stats |

What we deliberately did not borrow: death, sickness, care mistakes that punish you, and anything random you can pay for.

### Stat balance

Raw tool counts are dominated by reading and searching, which would make nearly every pet a Lore pet and leave Roam and Swarm unreachable. Lineage is picked by weighted affinity instead: Craft ×1, Lore ×0.5, Shell ×0.7, Test ×1, Roam ×3, Swarm ×5. Raw counts are still stored and shown, so "1,000 edits" stays true.

## 4. Architecture

```
Claude Code ──hook (async)──▶ src/hook.js ──POST /event──▶ daemon (127.0.0.1:4747)
Codex CLI ───notify─────────▶ src/hook.js --codex ──┘          │
                                                     classify ─▶ sessions ─▶ pet engine ─▶ ~/.openmon/pet.json
                                                                   │
                                          renderer(s) ◀── SSE /stream
                                (Electron pet window · OBS source · browser)
```

- `classify.js`: raw payload to a small signal (`tool-start`, `tool-done`, `tool-fail`, `test-start`, `test-end`, `attention`, `turn-start`, `turn-end`, `subagent-start`, `subagent-end`, `compact`, `session-start`, `session-end`, `api-error`). Adapters only need to produce these.
- `sessions.js`: live state per session and the aggregate pose.
- `pet.js`: pure progression engine (XP, stats, bond, stage, form, achievements). No clock or I/O inside; fully unit-tested.
- `species.js`: all lineages, stages, names, thresholds and visual parameters as data. Theme packs replace this file plus the drawing code.
- `store.js`: atomic, debounced persistence.
- `public/`: the renderer, plain canvas, no assets. Every form is drawn procedurally.
- `electron-main.js`: small transparent always-on-top window, drag to move, tray menu, OS notifications.

## 5. Roadmap

**v0.1 (this release)**: Claude Code adapter, ambient layer, 20 forms, XP/stats/bond, achievements, Electron pet, browser/OBS mode, installer that coexists with other hooks, demo mode.

**v0.2: "Show it off"** (done): natures, shinies, Opendex, trainer card, evolution scene, cries, chatter, generations and Hall of Fame.

**v0.3 "Seven cycles"** (done): see [REVIEW-LOG.md](REVIEW-LOG.md). Name window, levels, lineage eyes and brows, cursor tracking, idle acts, Chimera/Paragon, badges, honest alarms, adaptive frame rate, rename to Openmon.

**v0.4** (done): art packs, Nocturne variant, Brazilian Portuguese, `openmon autostart`, renderer smoke test, Content-Security-Policy on every page.

**v0.4.x**: commission a hand-drawn art pack, Gemini CLI adapter, Spanish, run `npm run smoke` in CI.

**v0.3: "Many agents"**: one helper creature per running session, click a helper to see that session, per-project nests.

**v0.4: "Ecosystem"**: theme/species packs as npm packages, community art contest, seasonal events (Halloween egg skins), VS Code status bar companion.

**v1.0: "Social" (opt-in)**: visit a friend's pet by link, team "habitat" for shared repos, weekly digest. Still no account required for the core.

## 6. What we will not do

- No crypto, no tokens, no NFTs.
- No paid evolution or loot boxes. If there is ever money, it is cosmetic packs from artists, with a revenue share.
- No mechanics that punish time away from the computer.
- No reading of prompt text, code or file contents beyond what is needed to classify a tool call. Nothing leaves the machine.
