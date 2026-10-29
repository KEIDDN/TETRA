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
let splash = null;
let pendingLink = null;

// Smooth from the first frame: use the GPU even where Chromium is cautious, and draw on it.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

/** The loading screen: shown at once, while the game loads behind it. */
const SPLASH_MIN_MS = 2400;
let splashShownAt = 0;

function createSplash() {
  splash = new BrowserWindow({
    width: 560,
    height: 360,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    center: true,
    backgroundColor: '#000000',
    skipTaskbar: true,
    alwaysOnTop: false,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  splash.once('ready-to-show', () => {
    splash?.show();
    splashShownAt = Date.now();
  });
  splash.on('closed', () => (splash = null));
  void splash.loadFile(path.join(__dirname, 'splash.html'));
}

/** Swaps the splash for the game once both are ready, never sooner than the splash's own animation. */
let revealed = false;
function reveal() {
  if (revealed || !win) return;
  revealed = true;
  const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - (splashShownAt || Date.now())));
  setTimeout(() => {
    if (!win) return;
    win.show();
    win.focus();
    if (pendingLink) deliver(pendingLink);
    pendingLink = null;
    setTimeout(() => splash?.close(), 120);
  }, wait);
}

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
  revealed = false;
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
  // The game says when its first screen is drawn; a fallback covers a page that never does.
  setTimeout(reveal, 10_000);
  win.on('closed', () => (win = null));
  // Anything that opens a new window (links, credits) goes to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // The window only ever shows TETRA; any other address opens in the browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://tetra/')) return;
    event.preventDefault();
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
  });
  void win.loadURL('app://tetra/');
}

ipcMain.on('app-ready', () => reveal());
ipcMain.on('quit', () => app.quit());

ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https:\/\//.test(url)) void shell.openExternal(url);
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
    if (file !== WEB && !file.startsWith(WEB + path.sep)) return new Response('Not found', { status: 404 });
    // The app is a single page: anything without an extension is the page itself.
    if (pathname === '/' || !path.extname(pathname)) file = path.join(WEB, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
  deliver(process.argv.find((a) => a.startsWith('tetra://')));
  createSplash();
  createWindow();
  checkForUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ── Updates ──────────────────────────────────────────────────
// Windows: the new version downloads quietly and installs on the next quit,
// or straight away if the player taps Restart. macOS: until the app is signed
// with a Developer ID it can't replace itself, so the player is offered the
// new download instead.
const RELEASES = 'https://github.com/keiddn/tetra/releases/latest/download';
const UPDATE_EVERY = 4 * 60 * 60 * 1000;

function tellWindow(update) {
  if (win && !win.isDestroyed()) win.webContents.send('update', update);
}

function newer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

function checkForUpdates() {
  if (!app.isPackaged) return;
  if (process.platform === 'win32') {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-downloaded', (info) => tellWindow({ state: 'ready', version: info.version }));
    autoUpdater.on('error', () => {});
    const check = () => autoUpdater.checkForUpdates().catch(() => {});
    check();
    setInterval(check, UPDATE_EVERY);
    return;
  }
  const check = async () => {
    try {
      const res = await net.fetch(`${RELEASES}/latest-mac.yml`);
      if (!res.ok) return;
      const version = /^version:\s*([\d.]+)/m.exec(await res.text())?.[1];
      if (version && newer(version, app.getVersion())) tellWindow({ state: 'download', version, url: `${RELEASES}/TETRA-mac.dmg` });
    } catch {
      // Offline: try again later.
    }
  };
  void check();
  setInterval(check, UPDATE_EVERY);
}

ipcMain.on('install-update', () => {
  if (process.platform !== 'win32') return;
  require('electron-updater').autoUpdater.quitAndInstall(true, true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
