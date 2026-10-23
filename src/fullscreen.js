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

// "Busy" also comes from any always-on-top window that covers the screen,
// even a see-through overlay of another app; so for those two answers the
// window in front must itself cover its monitor, and must not be a
// click-through overlay (WS_EX_TRANSPARENT) (5: not full screen).
const TYPE = `
using System; using System.Runtime.InteropServices;
public static class Q {
  [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int s);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, int f);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MI i);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  public struct RECT { public int L, T, R, B; }
  public struct MI { public int Size; public RECT Monitor, Work; public int Flags; }
  public static int State() {
    int s; SHQueryUserNotificationState(out s);
    if (s != 2 && s != 7) return s;
    IntPtr h = GetForegroundWindow(); RECT r; MI i = new MI(); i.Size = Marshal.SizeOf(typeof(MI));
    if (h == IntPtr.Zero || !GetWindowRect(h, out r) || !GetMonitorInfo(MonitorFromWindow(h, 2), ref i)) return s;
    if ((GetWindowLong(h, -20) & 0x20) != 0) return 5;
    return r.L <= i.Monitor.L && r.T <= i.Monitor.T && r.R >= i.Monitor.R && r.B >= i.Monitor.B ? s : 5;
  }
}`;

const SCRIPT = [
  `Add-Type -TypeDefinition '${TYPE.trim().replace(/\s*\n\s*/g, ' ')}'`,
  // Ends by itself if Openmon is gone (even after a crash).
  'while ($true) { if (-not (Get-Process -Id $env:OPENMON_PARENT -ErrorAction SilentlyContinue)) { exit }; [Console]::Out.WriteLine([Q]::State()); [Console]::Out.Flush(); Start-Sleep -Milliseconds 1500 }',
].join('; ');

function watchFullscreen(onChange) {
  if (process.platform !== 'win32') return () => {};
  let child = null;
  let full = false;
  let stopped = false;
  let buffer = '';
  const start = () => {
    if (stopped) return;
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, OPENMON_PARENT: String(process.pid) } });
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
