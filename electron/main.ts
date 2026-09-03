import { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { DaemonManager } from './daemon-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '..');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const daemonManager = new DaemonManager();

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Conduit',
    backgroundColor: '#faf8f5',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Native application menu
  setupNativeMenu();

  // Start background services (Daemon & Express Server)
  try {
    const status = await daemonManager.startServices(rootPath);
    mainWindow.webContents.send('conduit:daemon-status', status);
  } catch (err: any) {
    console.error('Failed to start daemon services:', err);
    mainWindow.webContents.send('conduit:daemon-status', { ready: false, port: 3200, error: err.message });
  }

  // Load Conduit UI
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // In production or local bundle, connect to the local server
    mainWindow.loadURL('http://127.0.0.1:3200/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupNativeMenu() {
  const isMac = process.platform === 'darwin';
  const template: any[] = [
    ...(isMac
      ? [
          {
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
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Local Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (mainWindow) {
              const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory'],
              });
              if (!result.canceled && result.filePaths.length > 0) {
                mainWindow.webContents.send('conduit:project-opened', result.filePaths[0]);
              }
            }
          },
        },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
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
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('conduit:select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Engineering Project Directory',
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('conduit:get-version', () => {
  return app.getVersion();
});

ipcMain.on('conduit:notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// App Lifecycle
app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  daemonManager.stopServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
