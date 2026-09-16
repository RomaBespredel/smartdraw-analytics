/**
 * SmartDraw Analytics — Electron main process.
 *
 * Responsibilities:
 *   1. Resolve a writable per-user data directory and expose SMARTDRAW_DB_PATH
 *      so the Next.js server stores its SQLite database there.
 *   2. Launch the Next.js server (dev or production standalone) and wait for
 *      http://127.0.0.1:PORT to become available.
 *   3. Open a BrowserWindow pointing at the local Next.js URL.
 *   4. Clean up child processes on quit.
 */

const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const waitOn = require('wait-on');

const IS_DEV = !app.isPackaged;
const PORT = 3000;
const URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let nextProcess = null;

/** Per-user data directory (used for the SQLite database). */
function resolveUserDataDir() {
  // app.getPath('userData') respects the app name and platform conventions:
  //   Windows: %APPDATA%/SmartDraw
  //   macOS:   ~/Library/Application Support/SmartDraw
  //   Linux:   ~/.config/SmartDraw
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Start the Next.js server (dev mode in development, standalone in prod). */
function startNextServer() {
  const dbPath = join(resolveUserDataDir(), 'smartdraw.db');
  process.env.SMARTDRAW_DB_PATH = dbPath;
  process.env.IS_ELECTRON = '1';
  process.env.DATABASE_URL = `file:${dbPath}`;

  const cwd = process.cwd();
  let cmd, args;

  if (IS_DEV) {
    // Development: launch `next dev` (or `bun run dev`) and rely on hot reload.
    cmd = process.platform === 'win32' ? 'bun.cmd' : 'bun';
    args = ['run', 'dev'];
  } else {
    // Production: run the standalone Next.js server built by `next build`.
    // The build copies the standalone server to .next/standalone.
    const server = join(cwd, '.next', 'standalone', 'server.js');
    cmd = process.execPath; // node bundled with Electron
    args = [server];
  }

  nextProcess = spawn(cmd, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  nextProcess.stdout?.on('data', (d) => process.stdout.write(d));
  nextProcess.stderr?.on('data', (d) => process.stderr.write(d));
  nextProcess.on('exit', (code) => {
    if (!app.isQuitting) {
      console.log(`[next] exited with code ${code}`);
    }
  });
}

async function waitForServer() {
  await waitOn({ resources: [URL], timeout: 60_000, interval: 500 });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f1410',
    title: 'SmartDraw Analytics',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(URL);

  // Open external links in the user's browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'Файл',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single-instance lock — prevent two copies from corrupting the DB.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    startNextServer();
    await waitForServer();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (nextProcess) {
    try {
      nextProcess.kill();
    } catch {
      // ignore
    }
  }
});

app.on('quit', () => {
  if (nextProcess) {
    try {
      nextProcess.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
});
