#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createDaemon, DEFAULT_PORT } = require('../src/server');
const installer = require('../src/install');
const { createStore } = require('../src/store');
const pet = require('../src/pet');
const { STAT_LABELS } = require('../src/species');

const [command = 'help', ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const option = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const base = `http://127.0.0.1:${DEFAULT_PORT}`;

const HELP = `
  openmon: a desktop pet that grows from your AI coding agent's work

  openmon install      add hooks to ~/.claude/settings.json (a backup is kept)
  openmon start        open the pet (tray icon; drag it anywhere)
  openmon demo         play a scripted agent session on a throwaway egg
  openmon stats        show your pet in the terminal
  openmon name <nickname>  give it a nickname (--clear: back to the species name)
  openmon backup [file]    save a backup now (or export to a file)
  openmon restore <file|latest>  bring back a pet from a backup
  openmon login        keep your pet in your GitHub account, on any computer (--gh: use the GitHub CLI's login)
  openmon sync         sync now (--keep-local / --use-github when both computers changed)
  openmon logout       stop syncing on this computer (the Gist stays in your account)
  openmon dex          open the Opendex: every form you have seen
  openmon card         open your trainer card, ready to share
  openmon stop         put your pet away (quits the app or daemon)
  openmon art          where to put an art pack, and the file names it uses
  openmon playground   a sandbox pet + control panel to try every feature now
                       (own save, port 4748; your real pet is not touched; --serve for browser only)
  openmon autostart on|off|status   open the pet when you log in
  openmon serve        daemon only; open ${base}/ in a browser or add it to OBS
  openmon codex        print the line that connects Codex CLI
  openmon install --agent gemini|cursor|opencode|aider   connect another agent
  openmon status       is the daemon running? are hooks installed?
  openmon uninstall    remove our hooks (your pet is kept in ~/.openmon)

  options
    --settings <file>   another Claude Code settings file (e.g. .claude/settings.json)
    --foreground        keep "openmon start" attached to this terminal
    OPENMON_PORT=<n>  change the port (default ${DEFAULT_PORT})
`;

async function isRunning() {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(800) });
    return (await res.json()).app === 'openmon';
  } catch {
    return false;
  }
}

function bar(ratio, width = 20) {
  const full = Math.round(ratio * width);
  return `${'█'.repeat(full)}${'░'.repeat(width - full)}`;
}

function printPet(p) {
  const v = pet.view(p);
  const days = Math.max(1, Math.ceil((Date.now() - v.bornAt) / 86400000));
  const max = Math.max(1, ...Object.values(v.stats));
  console.log(`\n  ${v.nickname ? `${v.nickname} the ${v.form}` : v.form}  ·  ${v.stage}  ·  day ${days}`);
  console.log(`  XP ${v.xp}  ${bar(v.progress.ratio)}  ${v.progress.next ? `${v.progress.xpToGo} to ${v.progress.next}` : 'final stage'}`);
  if (v.progress.needsBond) console.log(`  Needs bond ${v.progress.bondNeeded} to evolve (now ${v.bond})`);
  console.log(`  Bond ${v.bond}/100  ${bar(v.bond / 100)}\n`);
  for (const [stat, value] of Object.entries(v.stats)) console.log(`  ${STAT_LABELS[stat].padEnd(6)} ${bar(value / max, 14)} ${value}`);
  const got = Object.keys(v.achievements).length;
  console.log(`\n  ${v.counters.tools} tool calls · ${v.counters.testsGreen} green test runs · ${got} achievements\n`);
}

function openUrl(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
}

// Runs the pet and brings it back if it ever dies without being told to
// quit (a crashed GPU or network process can take Electron down on some
// machines). The pet writes "quit-intent" when you quit it on purpose.
function supervise(electron, foreground) {
  const fs = require('node:fs');
  const { homeDir } = require('../src/store');
  const main = path.join(__dirname, '..', 'src', 'electron-main.js');
  const intent = path.join(homeDir(), 'quit-intent');
  const log = (line) => {
    try {
      fs.mkdirSync(homeDir(), { recursive: true });
      fs.appendFileSync(path.join(homeDir(), 'error.log'), `${new Date().toISOString()} ${line}
`);
    } catch {}
  };
  let recent = [];
  const launch = () => {
    try {
      fs.unlinkSync(intent);
    } catch {}
    const child = spawn(electron, [main], { stdio: foreground ? 'inherit' : 'ignore', windowsHide: true });
    child.on('exit', (code, signal) => {
      if (fs.existsSync(intent)) process.exit(0);
      const now = Date.now();
      recent = recent.filter((t) => now - t < 10 * 60 * 1000);
      if (recent.length >= 5) {
        log('pet keeps exiting; supervisor gave up after 5 restarts in 10 minutes');
        process.exit(1);
      }
      recent.push(now);
      log(`pet exited unexpectedly (code ${code}, signal ${signal}); restarting`);
      setTimeout(launch, 2000);
    });
  };
  launch();
}

async function main() {
  switch (command) {
    case 'start': {
      if (await isRunning()) return console.log('Your Openmon is already running.');
      let electron;
      try {
        electron = require('electron');
      } catch {
        console.error('Electron is missing and could not be downloaded. Check your connection and try again, or use "openmon serve".');
        process.exit(1);
      }
      if (flag('foreground')) return supervise(electron, true);
      // A small detached supervisor keeps the pet alive (see supervise()).
      spawn(process.execPath, [__filename, 'supervise'], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
      console.log('Your Openmon is out. Drag it anywhere; right-click it for its card (More, at the bottom, has the pages and settings).');
      if (!installer.isInstalled()) console.log('Hooks are not installed yet: run "openmon install".');
      return;
    }

    case 'supervise':
      return supervise(require('electron'), false);

    case 'serve': {
      const playground = flag('playground-daemon');
      const daemon = createDaemon({ log: (line) => console.log(line), playground, cloud: playground ? null : require('../src/cloud').createCloud() });
      try {
        await daemon.listen();
        console.log(`Openmon daemon on ${base}/`);
      } catch (err) {
        console.error(err.code === 'EADDRINUSE' ? `Port ${DEFAULT_PORT} is busy. Is Openmon already running?` : err.message);
        process.exit(1);
      }
      const stop = () => daemon.close().then(() => process.exit(0));
      daemon.bus.on('shutdown', stop);
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      return;
    }

    case 'dex':
    case 'card': {
      if (!(await isRunning())) {
        console.error('Openmon is not running. Start it with "openmon start".');
        process.exit(1);
      }
      const url = `${base}/${command === 'dex' ? 'dex' : 'card'}.html`;
      openUrl(url);
      return console.log(`Opening ${url}`);
    }

    case 'playground': {
      const os = require('node:os');
      const env = { ...process.env, OPENMON_HOME: path.join(os.homedir(), '.openmon-playground'), OPENMON_PORT: '4748' };
      if (flag('serve')) {
        const { spawn: run } = require('node:child_process');
        console.log('Playground daemon on http://127.0.0.1:4748/  ·  panel: http://127.0.0.1:4748/playground.html  ·  pet: http://127.0.0.1:4748/?preview');
        return run(process.execPath, [path.join(__dirname, 'openmon.js'), 'serve', '--playground-daemon'], { stdio: 'inherit', env });
      }
      let electron;
      try {
        electron = require('electron');
      } catch {
        console.error('Electron is missing and could not be downloaded. Check your connection and try again, or use "openmon playground --serve".');
        process.exit(1);
      }
      const main = path.join(__dirname, '..', 'src', 'electron-main.js');
      // No windowsHide: on Windows it hides the first window the app shows,
      // and here that is the control panel.
      const child = spawn(electron, [main, '--playground'], { stdio: 'ignore', detached: true, env });
      child.unref();
      return console.log('Playground open: a sandbox pet next to yours and a control panel. Close the panel to end it.');
    }

    case 'autostart': {
      const mode = rest[0] || 'status';
      if (!['on', 'off', 'status'].includes(mode)) return console.error('Usage: openmon autostart on|off|status');
      const { spawnSync } = require('node:child_process');
      const electron = require('electron');
      const main = path.join(__dirname, '..', 'src', 'electron-main.js');
      const r = spawnSync(electron, [main, '--autostart', mode], { encoding: 'utf8' });
      const state = /^(on|off)\s*$/m.exec(r.stdout || '');
      return console.log(state ? `Start with the computer: ${state[1]}` : 'Could not read the login item setting.');
    }

    case 'art': {
      const { homeDir } = require('../src/store');
      const { dexEntries } = require('../src/species');
      const dir = path.join(homeDir(), 'art');
      require('node:fs').mkdirSync(dir, { recursive: true });
      console.log(`Art pack folder: ${dir}\n`);
      console.log('One image per form (png, svg or webp). Optional ".shiny" and "@sleep|working|attention|error|done" variants.\n');
      for (const e of dexEntries()) console.log(`  ${e.key.padEnd(16)} ${e.name}`);
      console.log('\nGuide: docs/ART-PACKS.md');
      if (flag('open')) openUrl(dir);
      return;
    }

    case 'stop': {
      if (!(await isRunning())) return console.log('Openmon is not running.');
      await fetch(`${base}/api/shutdown`, { method: 'POST' });
      return console.log('Your Openmon went to sleep. Bring it back with "openmon start".');
    }

    case 'demo': {
      if (!(await isRunning())) {
        console.error('Openmon is not running. Start it with "openmon start" or "openmon serve".');
        process.exit(1);
      }
      const { durationMs } = await (await fetch(`${base}/api/demo`, { method: 'POST' })).json();
      return console.log(`Demo playing for about ${Math.round(durationMs / 1000)} seconds. Your real pet is not touched.`);
    }

    case 'stats': {
      if (await isRunning()) {
        const state = await (await fetch(`${base}/api/state`)).json();
        if (!state.demo) return printPet(state.pet);
      }
      return printPet(createStore().load());
    }

    case 'name': {
      const name = rest.filter((r) => !r.startsWith('--')).join(' ');
      if (!name.trim() && !flag('clear')) return console.error('Usage: openmon name <nickname>   (or --clear to use the species name)');
      if (await isRunning()) {
        await fetch(`${base}/api/rename`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      } else {
        const store = createStore();
        const p = store.load();
        pet.rename(p, name);
        store.save(p);
        store.flush();
      }
      return console.log(`Your Openmon is now called ${name.trim().slice(0, 24)}.`);
    }

    case 'install': {
      const agent = option('agent');
      if (agent === 'aider') return console.log(`Start Aider with:\n\n  ${installer.aiderLine()}\n`);
      if (agent === 'opencode') {
        const r = installer.installOpenCode();
        return console.log(`Plugin added: ${r.settingsPath}\nNew OpenCode sessions will feed your Openmon.`);
      }
      if (agent === 'gemini' || agent === 'cursor') {
        const r = agent === 'gemini' ? installer.installGemini() : installer.installCursor();
        console.log(`Hooks added to ${r.settingsPath}`);
        if (r.backupPath) console.log(`Backup: ${r.backupPath}`);
        return console.log(agent === 'gemini' ? 'New Gemini CLI sessions will feed your Openmon.' : 'Cursor agent chats will feed your Openmon (Cursor reloads hooks by itself).');
      }
      const result = installer.install({ settingsPath: option('settings') });
      console.log(`Hooks added to ${result.settingsPath}`);
      if (result.backupPath) console.log(`Backup: ${result.backupPath}`);
      return console.log('New Claude Code sessions will feed your Openmon. Open it with "openmon start".');
    }

    case 'backup': {
      const { createBackups, wrap } = require('../src/backup');
      const file = rest.find((r) => !r.startsWith('--'));
      if (await isRunning()) {
        await fetch(`${base}/api/backup`, { method: 'POST' });
      }
      const p = createStore().load();
      if (file) {
        fs.writeFileSync(file, `${JSON.stringify(wrap(p, {}, Date.now()), null, 2)}\n`);
        return console.log(`Saved ${file}`);
      }
      const b = createBackups();
      if (!(await isRunning())) b.maybe(p, {}, true);
      return console.log(`Backups: ${b.dir}\n${b.list().slice(0, 5).map((x) => `  ${x.file}  ${x.name} · ${x.form} · Lv ${x.level}`).join('\n')}`);
    }

    case 'restore': {
      const { createBackups, unwrap } = require('../src/backup');
      const what = rest.find((r) => !r.startsWith('--'));
      if (!what) return console.error('Usage: openmon restore <file|latest>');
      const save = what === 'latest' ? createBackups().latest() : unwrap(fs.readFileSync(what, 'utf8'));
      if (!save) return console.error('No backup found.');
      if (await isRunning()) return console.error('Put your pet away first ("openmon stop"), then restore.');
      const store = createStore();
      if (fs.existsSync(store.file)) fs.copyFileSync(store.file, `${store.file}.before-restore-${Date.now()}`);
      store.save(save.pet);
      store.flush();
      const { view } = require('../src/pet');
      const v = view(save.pet);
      return console.log(`Welcome back, ${v.name} (${v.form}, Lv ${v.level}). Your previous pet.json was kept next to it.`);
    }

    case 'login': {
      const method = rest.includes('--gh') ? 'gh' : 'device';
      const say = (r) => {
        if (r.ok && r.userCode) return console.log(`Open ${r.uri} and type the code ${r.userCode}. Openmon finishes on its own.`);
        if (r.ok) return console.log(`Signed in as @${r.login}. Your pet syncs with a secret Gist in your GitHub account; on another computer, run "openmon login" there.`);
        const why = {
          'no-gh': 'GitHub CLI not found or not signed in. Run "gh auth login" first, or plain "openmon login".',
          'gh-no-gist': 'Your GitHub CLI login cannot write Gists. Run "gh auth refresh -s gist", then try again.',
          'no-device': 'Sign-in with a code is not available in this build. Use the GitHub CLI: "gh auth login", then "openmon login --gh".',
        }[r.error];
        console.error(why || `Could not sign in (${r.error}).`);
        process.exitCode = 1;
      };
      if (await isRunning()) {
        const r = await (await fetch(`${base}/api/cloud/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }) })).json();
        return say(r);
      }
      const cloud = require('../src/cloud').createCloud();
      try {
        if (method === 'device') {
          const d = await cloud.startDevice();
          say({ ok: true, ...d });
          const r = await d.done;
          return say(r);
        }
        return say(await cloud.connectGh());
      } catch (err) {
        return say({ ok: false, error: err.message });
      }
    }

    case 'logout': {
      if (await isRunning()) await fetch(`${base}/api/cloud/logout`, { method: 'POST' });
      else require('../src/cloud').createCloud().logout();
      return console.log('This computer no longer syncs. The Gist stays in your GitHub account.');
    }

    case 'sync': {
      if (!(await isRunning())) return console.error('Open your pet first ("openmon start"); it syncs when it opens.');
      const use = rest.includes('--keep-local') ? 'local' : rest.includes('--use-github') ? 'remote' : null;
      const r = await (await fetch(`${base}/api/cloud/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ use }) })).json();
      const text = {
        off: 'Not signed in. Run "openmon login".',
        pushed: 'Saved to GitHub.',
        pull: 'Brought your pet from the other computer.',
        'up-to-date': 'Already in sync.',
        conflict: 'Both computers changed since the last sync. Keep one: "openmon sync --keep-local" or "openmon sync --use-github".',
      }[r.action];
      return console.log(text || `Could not sync (${r.error}).`);
    }

    case 'uninstall': {
      if (option('agent') === 'opencode') {
        const r = installer.uninstallOpenCode();
        return console.log(r.removed ? `Removed ${r.settingsPath}.` : 'No Openmon plugin found for OpenCode.');
      }
      if (option('agent') === 'gemini') {
        const r = installer.uninstall({ settingsPath: installer.geminiSettingsPath() });
        return console.log(r.removed ? `Removed ${r.removed} Openmon hooks from ${r.settingsPath}.` : 'No Openmon hooks found for Gemini CLI.');
      }
      if (option('agent') === 'cursor') {
        const r = installer.uninstallCursor();
        return console.log(r.removed ? `Removed ${r.removed} Openmon hooks from ${r.settingsPath}.` : 'No Openmon hooks found for Cursor.');
      }
      const result = installer.uninstall({ settingsPath: option('settings') });
      return console.log(result.removed ? `Removed ${result.removed} hooks from ${result.settingsPath}. Your pet is kept.` : 'No Openmon hooks found.');
    }

    case 'codex':
      console.log('Add this line to ~/.codex/config.toml (top level):\n');
      return console.log(`  ${installer.codexNotifyLine()}\n`);

    case 'status': {
      console.log((await isRunning()) ? `Daemon: running on port ${DEFAULT_PORT}` : 'Daemon: not running');
      console.log(installer.isInstalled({ settingsPath: option('settings') }) ? 'Hooks: installed' : 'Hooks: not installed');
      // The assistant runs your Claude Code: is it there?
      const { spawnSync } = require('node:child_process');
      const v = process.platform === 'win32' ? spawnSync('claude --version', { encoding: 'utf8', shell: true, timeout: 15000, windowsHide: true }) : spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 });
      return console.log(v.status === 0 && v.stdout.trim() ? `Assistant: ready (${v.stdout.trim().split('\n')[0]})` : 'Assistant: Claude Code not found (npm install -g @anthropic-ai/claude-code, then run "claude" once)');
    }

    default:
      return console.log(HELP);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
