// TETRA for desktop: the web app in its own window, served from inside the package.
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const WEB = path.join(__dirname, 'web');
// A real origin (app://tetra) so absolute paths, fetch and storage work as on the web.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// Sign-in with Google or Apple finishes in the browser and comes back through tetra:// links.
if (process.defaultApp) app.setAsDefaultProtocolClient('tetra', process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient('tetra');

let win = null;
let pendingLink = null;

function deliver(url) {
  if (!url || !url.startsWith('tetra://')) return;
  if (!win) {
    pendingLink = url;
    return;
  }
  win.webContents.send('auth-callback', url);
  if (win.isMinimized()) win.restore();
  win.focus();
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_event, argv) => deliver(argv.find((a) => a.startsWith('tetra://'))));
app.on('open-url', (event, url) => {
  event.preventDefault();
  deliver(url);
});

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'TETRA',
    backgroundColor: '#000000',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // The game and its music keep time even when the window is behind another.
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => {
    win.show();
    if (pendingLink) deliver(pendingLink);
    pendingLink = null;
  });
  win.on('closed', () => (win = null));
  // Anything that opens a new window (links, credits) goes to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  void win.loadURL('app://tetra/');
}

ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url);
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
    if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
    // The app is a single page: anything without an extension is the page itself.
    if (pathname === '/' || !path.extname(pathname)) file = path.join(WEB, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
  deliver(process.argv.find((a) => a.startsWith('tetra://')));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
