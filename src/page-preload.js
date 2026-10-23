'use strict';

// The bridge for the app window's pages (Settings, "write to the agent"):
// only the few desktop actions a web page cannot do on its own.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openmonSettings', {
  call: (cmd, arg) => ipcRenderer.invoke('settings', String(cmd), arg),
  openName: () => ipcRenderer.send('open-name'),
  // Plain text to the clipboard, from the shell: it works even when the
  // browser's clipboard says no (window not focused).
  copyText: (text) => ipcRenderer.invoke('copy-text', String(text).slice(0, 20000)),
  copyImage: (dataUrl) => ipcRenderer.invoke('copy-image', String(dataUrl)),
  // Answered only in the "write to the agent" window.
  contactKey: () => ipcRenderer.invoke('contact-key'),
});
