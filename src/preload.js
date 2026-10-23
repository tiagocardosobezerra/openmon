'use strict';

// The only bridge between the pet page and the desktop shell.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openmonDesktop', {
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  menu: () => ipcRenderer.send('menu'),
  setInteractive: (on) => ipcRenderer.send('interactive', Boolean(on)),
  // The card is open: the window takes focus, so a click anywhere else closes it.
  cardOpen: (on) => ipcRenderer.send('card-open', Boolean(on)),
  onCommand: (fn) => ipcRenderer.on('command', (_e, cmd) => fn(cmd)),
  openPowers: () => ipcRenderer.send('open-powers'),
  openPage: (page) => ipcRenderer.send('open-page', String(page)),
  openName: () => ipcRenderer.send('open-name'),
  installHooks: () => ipcRenderer.send('install-hooks'),
  // "Write to the agent": kind is message, question or deny; ref the session or request id.
  openTalk: (kind, ref) => ipcRenderer.send('open-talk', { kind: String(kind), ref: String(ref) }),
  contactKey: () => ipcRenderer.invoke('contact-key'),
});
