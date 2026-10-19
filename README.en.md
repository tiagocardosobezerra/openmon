# Openmon

[Português](README.md) | **English**

**Your AI agent works. A little creature in the corner of your screen shows what it is doing, tells you when it needs you, and grows with every task.**

![Node.js 20+](https://img.shields.io/badge/node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Electron](https://img.shields.io/badge/electron-33-47848F?style=flat-square&logo=electron&logoColor=white)
![Claude Code](https://img.shields.io/badge/Claude%20Code-official%20hooks-D97757?style=flat-square&logo=anthropic&logoColor=white)
![100% local](https://img.shields.io/badge/data-100%25%20local-2ea44f?style=flat-square)
![MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

<img width="100%" alt="Openmon: an egg that hatches and evolves from your AI agent's work" src="assets/openmon-banner.en.svg" />

Openmon is a desktop pet, in the spirit of Pokémon and Tamagotchi, that lives in the corner of your screen while Claude Code works. It reads when your agent reads, hammers when it edits, raises a shield when the tests run, and jumps holding a sign when the agent **needs you**. Click it and the agent's window comes to the front, ready for you to approve or reply. Over the days, the egg hatches, grows and evolves into one of 22 forms, decided by the kind of work your agent does most.

## What it does for you

* **Tells you when your agent needs you.** A permission or a question: it jumps with a sign, shows the project and the request in plain words ("Wants permission to run a command: npm publish") and plays a soft chime. If you do not look, a notification follows.
* **Lets you answer right there (optional).** Turn on "Answer permissions from the pet" in the settings and the bubble gets **Allow** and **Deny**. Claude Code waits for your answer on the pet for up to 25 seconds; after that it asks you as usual. Off by default.
* **Takes you straight to the agent.** A click on the pet, its bubble or the notification brings the window your agent runs in to the front: a terminal, VS Code or the Claude app.
* **Shows what is happening, without watching the terminal.** A hammer is editing, a book reading, a shield testing, a spyglass the web. Several agents at once? The card lists each one and what it is doing.
* **Sums up every task.** When the agent finishes: "shop-api is done ✓ · 3 files · 12 commands · tests ✓ · 2m 10s".
* **Keeps a journal.** What your agents did each day, by kind of work and by project, and how long they waited for you.
* **Never in the way, never leaves your computer.** Clicks pass through its window, it never blocks or slows the agent, uses no internet, has no account, and passwords and keys show hidden (`•••`).
* **Never lost.** It keeps copies in Documents/Openmon Backups. New computer? On a fresh install it offers to bring your pet back.

## What it looks like

> **You:** fix the checkout tests
>
> **Claude:** reads the files, edits two of them and asks to run `npm publish`.
>
> **Openmon:** reads a book, picks up the hammer, raises the shield… and jumps with the sign: **"shop-api needs you · Wants permission to run a command: npm publish"**. You click it, the Claude window appears, you approve. It celebrates: **"All done! · 2 files · tests ✓"**, and gains experience.

<table>
<tr>
<td width="50%" align="center"><img src="docs/screens/pet-attention.en.png" width="300" alt="The pet jumps with a sign: the agent needs you"><br><sub>When your agent needs you</sub></td>
<td width="50%" align="center"><img src="docs/screens/pet-card.en.png" width="300" alt="The card with your agents, experience and friendship"><br><sub>Right-click: the card with your agents</sub></td>
</tr>
</table>

| What it does | What it means |
|---|---|
| Jumps holding the **!** sign | The agent waits for your permission or answer. Click it to go there |
| Hammer, book, terminal, shield, spyglass | The agent is editing, reading, running commands, testing or on the web |
| Little helpers flying around | The agent called other agents to help |
| Celebrates | The agent finished: your turn |
| Winces | Something failed, like a test |
| Sleeps | Nothing has happened for a few minutes |

## Start in 3 steps

You need [Node.js](https://nodejs.org) 20 or newer and [Claude Code](https://claude.com/claude-code).

### 1. Install

```bash
git clone https://github.com/tiagocardosobezerra/openmon.git
cd openmon
npm install
npm link
```

`npm link` creates the `openmon` command. npm 11 may ask you to approve Electron's install script: `npm install-scripts approve electron`.

### 2. Connect Claude Code

```bash
openmon install
```

Adds the notices (hooks) to `~/.claude/settings.json` and keeps a backup. For one project only: `openmon install --settings .claude/settings.json`. Forgot? The egg itself shows a **Connect** button.

### 3. Call your Openmon

```bash
openmon start
```

The egg appears in the corner of your screen and an icon shows up in the tray. Start a new Claude Code conversation and work as usual: it hatches during your first session. Want to see it first? `openmon demo`.

| Command | What it does |
|---|---|
| `openmon start` / `openmon stop` | Opens or puts away the pet |
| `openmon install` / `openmon uninstall` | Turns the Claude Code notices on or off (your pet is kept) |
| `openmon demo` | Plays a sample session on a throwaway egg |
| `openmon playground` | A test pet with a control panel: every form and scene in minutes |
| `openmon dex` / `openmon card` | Opens the Opendex or the trainer card |
| `openmon name <nickname>` | Gives it a nickname (`--clear` goes back to the species name) |
| `openmon backup [file]` / `openmon restore <file\|latest>` | Makes a copy or brings a pet back |
| `openmon autostart on\|off` | Opens the pet when you turn on the computer |
| `openmon stats` / `openmon status` | The pet in your terminal / whether everything is on |

## How it grows

Everything your agent does is worth **experience (XP)**. With enough, it evolves: egg, sprout, juvenile, adult and mythic, over weeks of use. Its **type** comes from the work your agent does most:

| Type | Comes from | Juvenile | Adult | Mythic |
|---|---|---|---|---|
| Craft | editing files | Tinkit | Forgemaw | Archsmith |
| Lore | reading and searching | Owlet | Scrollwyrm | Oracle |
| Shell | running commands | Sparkle | Voltcrab | Kernel |
| Test | running tests | Shellby | Bastion | Aegis |
| Roam | the web and MCP tools | Wisp | Skyfin | Wayfarer |
| Swarm | calling other agents | Mote | Hivekin | Legion |

Rare work counts more, so every type can win. And there is a hidden line few will find: *some say balance is the key.*

* **Friendship** (0 to 100) only goes up: answer your agent quickly, pet it with a click, come back every day. The mythic stage asks for friendship 60.
* **Personality**: every egg is born Brave, Sleepy, Curious, Cheerful, Calm or Cheeky, which changes how it moves and what it says.
* **Rarities**: 1 in 128 hatches in shiny colours; evolving late at night gives night colours.
* **Nickname**: without one it goes by its species name, like Pokémon. When it hatches, it asks whether you want to give it one.
* It never dies, never gets sick and never loses what it earned.

<table>
<tr>
<td width="50%"><img src="docs/screens/dex.en.png" alt="The Opendex with types and forms"><br><sub><b>Opendex</b>: the types, how to get each one and the 22 forms</sub></td>
<td width="50%"><img src="docs/screens/bag.en.png" alt="The Bag with items and accessories"><br><sub><b>Bag</b>: items and accessories to wear</sub></td>
</tr>
</table>

## Something every day

* **Missions**: three a day, like "answer your agent within 30 s, 3 times" or "3 green test runs". Each gives experience, friendship and a Snack.
* **Bag**: *Snack* (+2 friendship), *Rare candy* (one level up) and *Everstone* (while it holds it, it does not evolve).
* **12 accessories**: trainer cap, party hat, beanie, headphones, flower, nightcap, wizard hat, crown, scarf, bow tie, bandana and medal, each unlocked by an achievement. They show on the pet, in the Bag and on the trainer card.
* **Daily gift and streak**: a Snack per day of use, and a Rare candy every 7 days in a row.
* **Opendex, badges and Hall of Fame**: once yours reaches mythic, retire it to the Hall of Fame and start a new generation; the Bag, Opendex and badges carry over.

## Powers: tools that evolution unlocks

Each type your Openmon evolves into unlocks, for good, a useful panel about your agent's sessions:

| Power | Type | Shows |
|---|---|---|
| Forge log | Craft | every file changed, how many times, lines added and removed |
| Reading list | Lore | what the agent read and searched before acting |
| Command log | Shell | every command, whether it worked, how long it took, with a copy button |
| Test tracker | Test | every test run and the green streak |
| Travel log | Roam | pages opened, web searches and MCP tools |
| Hive view | Swarm | the helper agents, which still run and how long they took |

For everyone: the **Journal** of the last 14 days and the **waiting counter**, how long your agents waited for you today.

<img width="100%" alt="Powers, with the journal of the last 14 days" src="docs/screens/powers.en.png" />

## Going further

### Settings

Right-click the pet and click the gear on its card (or use the tray icon):

* **Quiet mode**: 30 minutes, 1 hour or until tomorrow. It still shows everything, silently.
* **Size**: small, normal or large.
* **Answer permissions from the pet**: Allow and Deny on the bubble (off by default).
* **Sounds**, **Chatter and emotes**, **Walk around**, **Notify when an agent waits**, **Start with the computer**.
* **Backups**: make a copy now, export your pet to a file, bring back a pet from a file, open the folder.
* **How it works**: a page with what each pose means and common questions.

Your choices are saved in `~/.openmon/config.json`; the pet in `~/.openmon/pet.json`.

### Your own art

The 22 forms ship as official vector art (`art/official`), with poses, shiny and night versions. To replace them, put images named after the form (`craft-adult.png`, `craft-adult.shiny@sleep.svg`…) in `~/.openmon/art`. The guide is [docs/ART-PACKS.md](docs/ART-PACKS.md). `OPENMON_CLASSIC=1` brings back the art drawn in code.

### Other agents

* **Codex CLI**: `openmon codex` prints the line to paste into `~/.codex/config.toml`. Codex only reports finished tasks, so the pet celebrates and grows but cannot show tools.
* **Anything else**: POST `{"_agent":"signal","session":"my-agent","kind":"tool-done","family":"craft"}` to `http://127.0.0.1:4747/event`. Kinds are listed in [`src/classify.js`](src/classify.js).

<details>
<summary><strong>How it works inside</strong></summary>

```
Claude Code ──hook (async)──▶ src/hook.js ──POST /event──▶ daemon (127.0.0.1:4747)
                                                             │ classify → sessions → pet
                                                             ▼                       │
                                     pet window / browser / OBS ◀── SSE /stream      └─▶ ~/.openmon/pet.json
```

* [`classify.js`](src/classify.js): turns the agent's notice into a small signal.
* [`sessions.js`](src/sessions.js): the state of each conversation and the one pose that matters most.
* [`pet.js`](src/pet.js): XP, friendship, evolution, missions, items and accessories, as pure functions.
* [`focus.js`](src/focus.js): finds the agent's window and brings it to the front.
* [`backup.js`](src/backup.js): the copies in Documents and the way back on a fresh install.
* [`public/art.js`](public/art.js): draws the official art, with blinking eyes and accessories in the right place.

The server only listens on `127.0.0.1` and refuses requests from other web pages (Origin and Host checks). The hook never prints, always exits 0 and gives up within 1.5 s. `openmon start` runs the pet under a supervisor that brings it back within two seconds if it ever falls over.

</details>

## Develop

```bash
npm install
npm test          # node:test, no extra dependencies
npm run smoke     # opens every page in hidden Electron windows and fails on any error
npm run serve     # then open http://127.0.0.1:4747/?preview
npm start         # the desktop pet
```

Design, principles and what comes next: [docs/DESIGN.md](docs/DESIGN.md). Review history: [docs/REVIEW-LOG.md](docs/REVIEW-LOG.md).

## License

MIT. Openmon is an independent fan project, not affiliated with Pokémon, Nintendo, Game Freak or The Pokémon Company.
