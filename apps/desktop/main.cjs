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
// Windows: electron-updater downloads the new version quietly and installs it
// on the next quit, or at once if the player taps Restart.
// macOS: Apple's updater only takes Developer ID-signed apps, so TETRA updates
// itself: it downloads the new .app (zipped) in the background, and on Restart
// (or the next quit) a small script swaps it in and opens it again.
const RELEASES = 'https://github.com/keiddn/tetra/releases/latest/download';
const UPDATE_EVERY = 30 * 60 * 1000;

function tellWindow(update) {
  if (win && !win.isDestroyed()) win.webContents.send('update', update);
}

function newer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

/** The running TETRA.app, if it lives somewhere it can be replaced (not the mounted .dmg). */
function appBundle() {
  const bundle = path.resolve(process.execPath, '../../..');
  if (!bundle.endsWith('.app') || bundle.startsWith('/Volumes/')) return null;
  try {
    require('node:fs').accessSync(path.dirname(bundle), require('node:fs').constants.W_OK);
    return bundle;
  } catch {
    return null;
  }
}

let macReady = null; // { version, app } once the new .app is unpacked and waiting
let macBusy = false;

async function downloadMac(version) {
  const fs = require('node:fs');
  const os = require('node:os');
  const { Readable } = require('node:stream');
  const { pipeline } = require('node:stream/promises');
  const { execFile } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tetra-update-'));
  const zip = path.join(dir, 'TETRA-mac.zip');
  const res = await net.fetch(`${RELEASES}/TETRA-mac.zip`);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  let got = 0;
  let shown = -1;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    got += chunk.length;
    const percent = total ? Math.floor((got / total) * 100) : 0;
    if (percent !== shown && percent % 5 === 0) {
      shown = percent;
      tellWindow({ state: 'downloading', version, percent });
    }
  });
  await pipeline(body, fs.createWriteStream(zip));
  const out = path.join(dir, 'unpacked');
  await new Promise((resolve, reject) => execFile('/usr/bin/ditto', ['-x', '-k', zip, out], (e) => (e ? reject(e) : resolve())));
  const name = fs.readdirSync(out).find((f) => f.endsWith('.app'));
  if (!name) throw new Error('no app in update');
  fs.rmSync(zip, { force: true });
  return path.join(out, name);
}

/** Swaps the waiting update in once TETRA has quit, then opens it. */
function installMac(relaunch) {
  const target = appBundle();
  if (!macReady || !target) return false;
  const fs = require('node:fs');
  const os = require('node:os');
  const { spawn } = require('node:child_process');
  const script = path.join(os.tmpdir(), `tetra-update-${Date.now()}.sh`);
  const q = (p) => `'${p.replace(/'/g, `'\\''`)}'`;
  fs.writeFileSync(
    script,
    [
      '#!/bin/sh',
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.2; done`,
      `rm -rf ${q(target)}`,
      `/usr/bin/ditto ${q(macReady.app)} ${q(target)}`,
      `/usr/bin/xattr -cr ${q(target)} 2>/dev/null`,
      relaunch ? `/usr/bin/open ${q(target)}` : '',
      `rm -rf ${q(path.dirname(path.dirname(macReady.app)))} ${q(script)}`,
    ].join('\n'),
    { mode: 0o755 },
  );
  spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref();
  macReady = null;
  return true;
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
    if (macBusy || macReady) return;
    try {
      const res = await net.fetch(`${RELEASES}/latest-mac.yml`);
      if (!res.ok) return;
      const version = /^version:\s*([\d.]+)/m.exec(await res.text())?.[1];
      if (!version || !newer(version, app.getVersion())) return;
      // Somewhere it can't replace itself (still on the .dmg): offer the download instead.
      if (!appBundle()) return tellWindow({ state: 'download', version, url: `${RELEASES}/TETRA-mac.dmg` });
      macBusy = true;
      const unpacked = await downloadMac(version);
      macReady = { version, app: unpacked };
      tellWindow({ state: 'ready', version });
    } catch {
      // Offline or interrupted: try again later.
    } finally {
      macBusy = false;
    }
  };
  void check();
  setInterval(check, UPDATE_EVERY);
  // Coming back to the app is a good moment to look again (at most every ten minutes).
  let lastFocusCheck = Date.now();
  app.on('browser-window-focus', () => {
    if (Date.now() - lastFocusCheck < 10 * 60 * 1000) return;
    lastFocusCheck = Date.now();
    void check();
  });
}

ipcMain.on('install-update', () => {
  if (process.platform === 'win32') return require('electron-updater').autoUpdater.quitAndInstall(true, true);
  if (installMac(true)) app.quit();
});

// Quitting with an update waiting installs it, like on Windows.
app.on('before-quit', () => {
  if (process.platform === 'darwin' && macReady) installMac(false);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
