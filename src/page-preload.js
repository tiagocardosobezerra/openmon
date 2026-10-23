'use strict';

// The bridge for the app window's pages (Settings, "write to the agent"):
// only the few desktop actions a web page cannot do on its own.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openmonSettings', {
  call: (cmd, arg) => ipcRenderer.invoke('settings', String(cmd), arg),
  openName: () => ipcRenderer.send('open-name'),
  // Answered only in the "write to the agent" window.
  contactKey: () => ipcRenderer.invoke('contact-key'),
});
