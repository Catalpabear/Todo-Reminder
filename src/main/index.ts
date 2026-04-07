import { app, BrowserWindow, globalShortcut, shell ,Tray, Menu} from 'electron';
import { join } from 'node:path';

import { electronApp, is, optimizer } from '@electron-toolkit/utils';

import { TodoRepository } from './database/todoRepository';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { ReminderScheduler } from './scheduler/reminderScheduler';
import { WindowManager } from './window/windowManager';

import icon from '../../resources/logo.png?asset';

let repository: TodoRepository | null = null;
let scheduler: ReminderScheduler | null = null;
let windowManager: WindowManager | null = null;
let tray: Tray | null = null;

function createMainWindow(): BrowserWindow {
  if (!windowManager) {
    throw new Error('Window manager not initialized');
  }

  const mainWindow = windowManager.createWindow();
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

function createTray() {
  const trayIcon = icon // 你已经有 icon 资源 👍

  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => windowManager?.showAndFocus()
    },
    {
      label: '退出',
      click: () => app.quit()
    }
  ])

  tray.setToolTip('TODO Reminder')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    windowManager?.showAndFocus()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.todo.reminder.desktop');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const dbPath = join(app.getPath('userData'), 'todo-reminder.db');
  repository = new TodoRepository(dbPath);
  windowManager = new WindowManager(join(__dirname, '../preload/index.js'), icon);

  registerIpcHandlers(repository, windowManager);

  scheduler = new ReminderScheduler(repository, () => {
    windowManager?.showAndFocus();
  });
  scheduler.start();

  createMainWindow();
  createTray();

  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (!windowManager) {
      return;
    }
    const next = !windowManager.getClickThrough();
    windowManager.setClickThrough(next);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      windowManager?.showAndFocus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  scheduler?.stop();
  repository?.close();
});
