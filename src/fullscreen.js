'use strict';

// Is a full-screen app, a game or a presentation in front? Windows says so
// (SHQueryUserNotificationState, the same signal it uses to hold back its
// own notifications). One small PowerShell process asks every 1.5 s and
// prints the answer; the pets step aside while it is "busy". Other systems:
// nothing to watch (the pets keep their place).

const { spawn } = require('node:child_process');

// QUNS_BUSY (a full-screen app), QUNS_RUNNING_D3D_FULL_SCREEN (a game),
// QUNS_PRESENTATION_MODE, QUNS_APP (a full-screen Store app).
const FULL = new Set([2, 3, 4, 7]);

const SCRIPT = [
  "Add-Type -Namespace Om -Name Q -MemberDefinition '[DllImport(\"shell32.dll\")] public static extern int SHQueryUserNotificationState(out int state);'",
  'while ($true) { $s = 0; [void][Om.Q]::SHQueryUserNotificationState([ref]$s); [Console]::Out.WriteLine($s); [Console]::Out.Flush(); Start-Sleep -Milliseconds 1500 }',
].join('; ');

function watchFullscreen(onChange) {
  if (process.platform !== 'win32') return () => {};
  let child = null;
  let full = false;
  let stopped = false;
  let buffer = '';
  const start = () => {
    if (stopped) return;
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    child.stdout.on('data', (d) => {
      buffer += d;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        const state = Number(line.trim());
        if (!Number.isFinite(state) || !state) continue;
        const now = FULL.has(state);
        if (now !== full) {
          full = now;
          onChange(full);
        }
      }
    });
    // If it ever stops, start it again a little later.
    child.on('exit', () => setTimeout(start, 10_000).unref());
    child.on('error', () => {});
  };
  start();
  return () => {
    stopped = true;
    if (child) child.kill();
  };
}

module.exports = { watchFullscreen, FULL };
