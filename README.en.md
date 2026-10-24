# Openmon

[Português](README.md) | **English** | [Español](README.es.md)

**Did your AI agent stop to ask for permission without you noticing? Openmon is a little creature in the corner of your screen that tells you the moment the agent waits for you, and you answer with one click.**

![Node.js 22.12+](https://img.shields.io/badge/node.js-22.12%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Electron](https://img.shields.io/badge/electron-44-47848F?style=flat-square&logo=electron&logoColor=white)
![Claude Code](https://img.shields.io/badge/Claude%20Code-official%20hooks-D97757?style=flat-square&logo=anthropic&logoColor=white)
![100% local](https://img.shields.io/badge/data-100%25%20local-2ea44f?style=flat-square)
![MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

<img width="100%" alt="Openmon animation: an egg hatches in the corner of the screen; the creature reads, hammers and tests along with your AI agent; when the agent needs permission it jumps with a sign and you answer with one click; it is also your assistant: you ask for a reminder in a small box next to it, and on time it tells you; it evolves with the work and becomes a collection of 39 forms, with shiny ones and legendaries. Your agent works. Your Openmon grows and helps you." src="assets/openmon-banner.en.svg" />

Agents like Claude Code work on their own for minutes, but they stop silently when they need you: a permission, a question, the end of the task. You come back half an hour later and it was waiting since the start. Openmon follows every conversation and calls you only when it matters.

## What it does for you

* **Tells you when your agent needs you.** A permission or a question: it jumps with a sign, shows the project and the request in plain words ("Wants permission to run a command: npm publish") and plays a soft chime. If you do not look, a notification follows.
* **Lets you answer and talk to your agent right there.** With Claude Code, the bubble gets **Allow** and **Deny** on permission requests and the options of each question the agent asks; **Message** writes to the conversation the pet follows, and reaches an idle agent right away. Claude Code waits for your answer on the pet for up to 25 seconds; after that it asks you as usual. Nothing is ever approved on its own: only your click answers. Turn it off in Settings → "Answer from the pet".
* **Takes you to the agent in one click.** A click on the pet, its bubble or the notification brings the window your agent runs in to the front: a terminal, VS Code or the Claude app.
* **Shows what is happening, without watching the terminal.** A hammer is editing, a book reading, a shield testing, a spyglass the web. Several agents at once? The card lists each one and what it is doing.
* **Also tells you when something looks wrong.** The agent stuck for 4 minutes in the middle of a task, the same failure 3 times in a row, or a dangerous command (`rm -rf`, `git push --force`, `DROP TABLE`) that turns the request **red**.
* **Sums up every task.** When the agent finishes: "shop-api is done ✓ · 3 files · 12 commands · tests ✓ · 2m 10s".
* **Never in the way, never leaves your computer.** Clicks pass through its window, it never blocks or slows the agent, uses no account and sends nothing of yours to the internet (it only checks once a day for a new version; phone alerts and GitHub are yours to turn on), and passwords and keys show hidden (`•••`).

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

## Install in 3 steps

1. Download the installer from [Releases](https://github.com/tiagocardosobezerra/openmon/releases/latest): Windows `.exe`, macOS `.dmg` (Apple Silicon) or Linux `.AppImage`.
2. Open Openmon and click **Connect** on the egg's bubble. This connects Claude Code.
3. Choose your first Openmon: Tinkit (edits), Owlet (reading and search) or Sparkle (commands). Then start a new Claude Code conversation and work as usual: the egg hatches during your first session.

The agent notices run with [Node.js](https://nodejs.org), which Claude Code users already have. The installers are not signed yet: on Windows, click "More info → Run anyway"; on macOS, right-click the app and choose "Open". Prefer the source? See [Install from source](docs/GUIDE.en.md#install-from-source).

**Privacy:** everything stays on your computer, with no account. Its only trip to the internet is once a day, to check GitHub for a new version (you can turn it off); phone alerts and GitHub are optional. The assistant uses your Claude Code, which talks to Anthropic as it always does; Openmon sends nothing more.

## And also

* **Your personal assistant.** `Ctrl+Alt+C` opens a chat with your own Claude Code, without opening Claude and without an API key, and `Ctrl+Alt+A` asks a quick question next to the pet. It creates reminders and tasks and keeps what it should remember. See [the assistant](docs/ASSISTANT.en.md).
* **A game.** The egg hatches, grows and evolves into one of 39 forms based on your agent's work, with items, accessories, legendaries and missions. See [the game](docs/GAME.en.md).
* **Everything else** is in the [guide](docs/GUIDE.en.md): the diary, hours per project, focus mode, phone alerts, other agents (Gemini CLI, Cursor, OpenCode, Aider, Codex), settings, commands and installing from source.

## How it works inside

<img width="100%" alt="How Openmon works inside: AI agents report each step through hooks; a local server at 127.0.0.1:4747 turns each notice into a signal; the pet picks a pose, earns experience and logs what the agent did; everything shows up in the corner of the screen; and, as your assistant, it answers with your own Claude Code, which can set reminders, keep what it should remember and speak through the bubble. Openmon sends nothing more." src="assets/openmon-dentro.en.svg" />

1. **The agent reports.** Claude Code, Gemini CLI, Cursor, OpenCode and Aider already report every step they take (hooks). Openmon only listens and never blocks anything.
2. **It becomes a signal.** A local server at `127.0.0.1:4747` turns each notice into a simple signal: a tool used, a green or red test, "needs you".
3. **The pet decides.** It picks a pose, earns experience in the right kind of work and logs what the agent did in its Skills.
4. **It shows up on screen.** Everything stays in the corner of your screen. Nothing of yours leaves your computer; it only checks once a day for a new version (phone alerts and GitHub are optional: one only sends "Your agent needs you", the other keeps your pet in a secret Gist in your account).
5. **It answers.** As your assistant, it runs your own Claude Code (`claude -p`, with your login and connectors, no API key), which talks to Anthropic as it always does. Claude can use Openmon's tools: set reminders and tasks, keep things in memory, speak through the bubble. Openmon sends nothing more.

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

MIT. Openmon is an independent project, with original creatures and art.
