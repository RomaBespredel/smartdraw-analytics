/**
 * Preload script — runs in an isolated context with limited Node access.
 * Currently we expose nothing to the renderer (the app talks to the local
 * Next.js server over HTTP), but keeping the preload lets us add native IPC
 * later (file dialogs, auto-update, etc.) without changing the build.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('smartdraw', {
  version: '1.0.0',
  isElectron: true,
});
