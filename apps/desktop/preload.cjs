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
});
