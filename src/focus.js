'use strict';

// "Take me there": when an agent waits for approval, a click on the pet
// brings the window that runs that agent to the front (the terminal,
// VS Code, the Claude app...), so you can approve or deny right away.
//
// The hook process walks up its own process tree (while its parents are
// still alive) to the first ancestor that owns a visible window: the
// agent's window. The daemon asks for that once per session and keeps it.
// Hooks run async, so the walk never slows the agent down.

const { execFile } = require('node:child_process');
const fs = require('node:fs');

const MAX_DEPTH = 14;

function run(cmd, args, timeout = 6000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => resolve(err ? null : String(stdout || '').trim()));
  });
}

const ps = (script) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);

const isPid = (n) => Number.isInteger(n) && n > 1 && n < 2 ** 31;

// Platform drivers: find(pid) -> { pid, app } | null, raise(win) -> boolean.
const drivers = {
  win32: {
    async find(pid) {
      const out = await ps(`
        $p = ${pid}
        for ($i = 0; $i -lt ${MAX_DEPTH} -and $p -gt 1; $i++) {
          $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
          if ($proc -and $proc.MainWindowHandle -ne 0) { "$p|$($proc.ProcessName)|$($proc.MainWindowTitle)"; exit }
          $row = Get-CimInstance Win32_Process -Filter "ProcessId=$p" -Property ParentProcessId -ErrorAction SilentlyContinue
          if (-not $row) { exit }
          $p = [int]$row.ParentProcessId
        }`);
      const [id, app, title] = (out || '').split('|');
      return isPid(Number(id)) ? { pid: Number(id), app, title: title || '' } : null;
    },
    async raise(win) {
      // Windows only lets a process that just got input steal the
      // foreground; a tap on Alt counts as that input.
      const out = await ps(`
        Add-Type -Namespace Openmon -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int n);
[DllImport("user32.dll")] public static extern bool IsIconic(System.IntPtr h);
[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, int f, int e);
'@
        $proc = Get-Process -Id ${win.pid} -ErrorAction SilentlyContinue
        if (-not $proc -or $proc.MainWindowHandle -eq 0) { "no"; exit }
        $h = $proc.MainWindowHandle
        if ([Openmon.W]::IsIconic($h)) { [void][Openmon.W]::ShowWindow($h, 9) }
        [Openmon.W]::keybd_event(0x12, 0, 0, 0); [Openmon.W]::keybd_event(0x12, 0, 2, 0)
        if ([Openmon.W]::SetForegroundWindow($h)) { "ok" } else { "no" }`);
      return out === 'ok';
    },
  },
  darwin: {
    async find(pid) {
      // The first ancestor that lives inside an .app bundle.
      let p = pid;
      for (let i = 0; i < MAX_DEPTH && p > 1; i++) {
        const out = await run('ps', ['-o', 'ppid=,comm=', '-p', String(p)]);
        const m = (out || '').match(/^\s*(\d+)\s+(.*)$/);
        if (!m) return null;
        const app = m[2].match(/([^/]+)\.app\/Contents\/MacOS\//);
        if (app) return { pid: p, app: app[1] };
        p = Number(m[1]);
      }
      return null;
    },
    async raise(win) {
      const out = await run('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${win.pid}) to true`]);
      return out !== null;
    },
  },
  linux: {
    async find(pid) {
      // Best effort: the first ancestor xdotool knows a window for.
      let p = pid;
      for (let i = 0; i < MAX_DEPTH && p > 1; i++) {
        const ids = await run('xdotool', ['search', '--pid', String(p)]);
        if (ids) return { pid: p, app: readComm(p), window: ids.split('\n').pop() };
        try {
          p = Number(fs.readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' ')[1]);
        } catch {
          return null;
        }
      }
      return null;
    },
    async raise(win) {
      if (!win.window) return false;
      await run('xdotool', ['windowactivate', win.window]);
      return true;
    },
  },
};

function readComm(pid) {
  try {
    return fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
  } catch {
    return '';
  }
}

// A window as reported by a hook, checked before it is trusted.
function cleanWindow(win) {
  if (!win || typeof win !== 'object') return null;
  const pid = Number(win.pid);
  if (!isPid(pid)) return null;
  const text = (v) => (typeof v === 'string' ? v.slice(0, 120) : '');
  const out = { pid, app: text(win.app), title: text(win.title) };
  if (typeof win.window === 'string' && /^\d{1,12}$/.test(win.window)) out.window = win.window;
  return out;
}

function createFocus({ driver = drivers[process.platform] || null, now = Date.now } = {}) {
  // session id -> { win, askedAt }
  const sessions = new Map();
  const ASK_AGAIN_MS = 60_000;
  // Sessions that never ended (a crash, a closed terminal) do not pile up.
  const keep = (sessionId, entry) => {
    sessions.delete(sessionId);
    sessions.set(sessionId, entry);
    if (sessions.size > 200) sessions.delete(sessions.keys().next().value);
  };

  return {
    // Whether the hook for this session should look its window up now.
    wants(sessionId) {
      if (!driver || !sessionId) return false;
      const entry = sessions.get(sessionId) || {};
      if (entry.win || (entry.askedAt != null && now() - entry.askedAt < ASK_AGAIN_MS)) return false;
      keep(sessionId, { ...entry, askedAt: now() });
      return true;
    },
    setWindow(sessionId, win) {
      const clean = cleanWindow(win);
      if (!sessionId || !clean) return false;
      keep(sessionId, { win: clean, askedAt: now() });
      return true;
    },
    forget(sessionId) {
      sessions.delete(sessionId);
    },
    windowOf(sessionId) {
      const entry = sessions.get(sessionId);
      return entry ? entry.win || null : null;
    },
    // Brings the session's window to the front: { ok, app } or { ok: false, reason }.
    async focus(sessionId) {
      const entry = sessions.get(sessionId);
      if (!driver) return { ok: false, reason: 'unsupported' };
      if (!entry || !entry.win) return { ok: false, reason: 'unknown' };
      const ok = await driver.raise(entry.win).catch(() => false);
      if (!ok) {
        // The window may be gone; the next hook event looks again.
        sessions.set(sessionId, { askedAt: null });
        return { ok: false, reason: 'refused', app: entry.win.app };
      }
      return { ok: true, app: entry.win.app };
    },
  };
}

module.exports = { createFocus, drivers, cleanWindow };
