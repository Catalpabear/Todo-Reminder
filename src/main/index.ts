import { app, BrowserWindow, globalShortcut, Menu, shell, Tray } from 'electron';
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
let pomodoroWindow: BrowserWindow | null = null;

function loadRendererWindow(window: BrowserWindow, hash?: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    const url = hash ? `${process.env.ELECTRON_RENDERER_URL}#${hash}` : process.env.ELECTRON_RENDERER_URL;
    window.loadURL(url);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined);
  }
}

function createMainWindow(): BrowserWindow {
  if (!windowManager) {
    throw new Error('Window manager not initialized');
  }

  const mainWindow = windowManager.createWindow();
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  loadRendererWindow(mainWindow);
  return mainWindow;
}

function createPomodoroWindow(): BrowserWindow {
  if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
    if (pomodoroWindow.isMinimized()) {
      pomodoroWindow.restore();
    }

    pomodoroWindow.show();
    pomodoroWindow.focus();
    return pomodoroWindow;
  }

  pomodoroWindow = new BrowserWindow({
    width: 460,
    height: 640,
    minWidth: 360,
    minHeight: 520,
    show: false,
    title: '番茄钟',
    autoHideMenuBar: true,
    resizable: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  pomodoroWindow.on('ready-to-show', () => {
    pomodoroWindow?.show();
  });

  pomodoroWindow.on('closed', () => {
    pomodoroWindow = null;
  });

  pomodoroWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  loadRendererWindow(pomodoroWindow, 'pomodoro');
  return pomodoroWindow;
}

function createTray(): void {
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => windowManager?.showAndFocus()
    },
    {
      label: '番茄钟',
      click: () => createPomodoroWindow()
    },
    {
      label: '退出',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('TODO Reminder');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    windowManager?.showAndFocus();
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.todo.reminder.desktop');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const dbPath = join(app.getPath('userData'), 'todo-reminder.db');
  repository = new TodoRepository(dbPath);
  windowManager = new WindowManager(join(__dirname, '../preload/index.js'), icon);

  registerIpcHandlers(repository, windowManager, {
    openPomodoroWindow: createPomodoroWindow
  });

  scheduler = new ReminderScheduler(repository, () => {
    windowManager?.showAndFocus();
  });
  scheduler.start();

  createMainWindow();
  createTray();

  globalShortcut.register('Alt+X', () => {
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
