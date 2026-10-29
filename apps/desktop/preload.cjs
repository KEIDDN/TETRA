// The little the web app needs from the desktop: open links outside, and hear back from sign-in.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tetraDesktop', {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onAuthCallback: (listener) => {
    const handler = (_event, url) => listener(url);
    ipcRenderer.on('auth-callback', handler);
    return () => ipcRenderer.removeListener('auth-callback', handler);
  },
  onUpdate: (listener) => {
    const handler = (_event, update) => listener(update);
    ipcRenderer.on('update', handler);
    return () => ipcRenderer.removeListener('update', handler);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  ready: () => ipcRenderer.send('app-ready'),
  quit: () => ipcRenderer.send('quit'),
});
