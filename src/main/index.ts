import { app, BrowserWindow, globalShortcut, shell } from 'electron';
import { join } from 'node:path';

import { electronApp, is, optimizer } from '@electron-toolkit/utils';

import { TodoRepository } from './database/todoRepository';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { ReminderScheduler } from './scheduler/reminderScheduler';
import { WindowManager } from './window/windowManager';

import icon from '../../resources/icon.png?asset';

let repository: TodoRepository | null = null;
let scheduler: ReminderScheduler | null = null;
let windowManager: WindowManager | null = null;

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
