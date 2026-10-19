'use strict';

// The only bridge between the pet page and the desktop shell.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openmonDesktop', {
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  menu: () => ipcRenderer.send('menu'),
  setInteractive: (on) => ipcRenderer.send('interactive', Boolean(on)),
  onCommand: (fn) => ipcRenderer.on('command', (_e, cmd) => fn(cmd)),
  openPowers: () => ipcRenderer.send('open-powers'),
});
