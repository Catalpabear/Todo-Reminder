import { app, BrowserWindow, globalShortcut, Menu, shell, Tray } from 'electron'
import { join } from 'node:path'

import { electronApp, is, optimizer } from '@electron-toolkit/utils'

import type { WindowMode } from '../shared/todo'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { TodoRepository } from './database/todoRepository'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { ReminderScheduler } from './scheduler/reminderScheduler'
import { SettingsStore } from './settings/settingsStore'
import { WindowManager } from './window/windowManager'

import icon from '../../resources/logo.png?asset'

const SETTINGS_WIDTH = 380
const SETTINGS_HEIGHT = 440
const POMODORO_WIDTH = 330
const POMODORO_HEIGHT = 310
const FOREVER_BLUR_OPACITY = 0.3
const DESKTOP_BLUR_OPACITY = 0.2
const FOCUS_OPACITY = 1

let repository: TodoRepository | null = null
let settingsStore: SettingsStore | null = null
let scheduler: ReminderScheduler | null = null
let windowManager: WindowManager | null = null
let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let pomodoroWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

function loadRendererWindow(window: BrowserWindow, hash?: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    const url = hash
      ? `${process.env.ELECTRON_RENDERER_URL}#${hash}`
      : process.env.ELECTRON_RENDERER_URL
    window.loadURL(url)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

function applyPomodoroMode(mode: WindowMode): void {
  if (!pomodoroWindow || pomodoroWindow.isDestroyed()) {
    return
  }

  if (mode === 'forever') {
    pomodoroWindow.setAlwaysOnTop(true, 'screen-saver')
    if (pomodoroWindow.isMinimized()) {
      pomodoroWindow.restore()
    }
    pomodoroWindow.setOpacity(pomodoroWindow.isFocused() ? FOCUS_OPACITY : FOREVER_BLUR_OPACITY)
    return
  }

  pomodoroWindow.setAlwaysOnTop(false)
  pomodoroWindow.setOpacity(pomodoroWindow.isFocused() ? FOCUS_OPACITY : DESKTOP_BLUR_OPACITY)
}

function registerClickThroughShortcut(accelerator: string): void {
  globalShortcut.unregisterAll()
  try {
    globalShortcut.register(accelerator, () => {
      if (!windowManager) {
        return
      }
      const next = !windowManager.getClickThrough()
      windowManager.setClickThrough(next)
      settingsStore?.updateSettings({ clickThrough: next })
    })
  } catch {
    // Fall back to default if registration fails.
    globalShortcut.register(DEFAULT_SETTINGS.clickThroughShortcut, () => {
      if (!windowManager) {
        return
      }
      const next = !windowManager.getClickThrough()
      windowManager.setClickThrough(next)
      settingsStore?.updateSettings({ clickThrough: next })
    })
  }
}

function broadcastSettingsChanged(): void {
  if (!settingsStore) {
    return
  }
  const snapshot = settingsStore.getSettings()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settingsChanged', snapshot)
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settingsChanged', snapshot)
  }
}

function createMainWindow(): BrowserWindow {
  if (!windowManager) {
    throw new Error('Window manager not initialized')
  }

  mainWindow = windowManager.createWindow()
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRendererWindow(mainWindow)
  return mainWindow
}

function createPomodoroWindow(): BrowserWindow {
  if (pomodoroWindow && !pomodoroWindow.isDestroyed()) {
    if (pomodoroWindow.isMinimized()) {
      pomodoroWindow.restore()
    }

    pomodoroWindow.show()
    pomodoroWindow.focus()
    applyPomodoroMode(windowManager?.getMode() ?? 'forever')
    return pomodoroWindow
  }

  pomodoroWindow = new BrowserWindow({
    width: POMODORO_WIDTH,
    height: POMODORO_HEIGHT,
    minWidth: POMODORO_WIDTH,
    minHeight: POMODORO_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    title: 'Pomodoro',
    autoHideMenuBar: true,
    resizable: true,
    alwaysOnTop: windowManager?.getMode() !== 'desktop',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  pomodoroWindow.on('ready-to-show', () => {
    pomodoroWindow?.show()
    applyPomodoroMode(windowManager?.getMode() ?? 'forever')
  })

  pomodoroWindow.on('focus', () => {
    pomodoroWindow?.setOpacity(FOCUS_OPACITY)
  })

  pomodoroWindow.on('blur', () => {
    const mode = windowManager?.getMode() ?? 'forever'
    if (mode === 'forever') {
      pomodoroWindow?.setOpacity(FOREVER_BLUR_OPACITY)
      return
    }

    pomodoroWindow?.setOpacity(DESKTOP_BLUR_OPACITY)
    setTimeout(() => {
      if (
        pomodoroWindow &&
        !pomodoroWindow.isDestroyed() &&
        mode === 'desktop' &&
        !pomodoroWindow.isFocused()
      ) {
        pomodoroWindow.minimize()
      }
    }, 180)
  })

  pomodoroWindow.on('closed', () => {
    pomodoroWindow = null
  })

  pomodoroWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRendererWindow(pomodoroWindow, 'pomodoro')
  return pomodoroWindow
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore()
    }

    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    minWidth: 320,
    minHeight: 380,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    title: '设置',
    autoHideMenuBar: true,
    resizable: true,
    alwaysOnTop: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  loadRendererWindow(settingsWindow, 'settings')
  return settingsWindow
}

function createTray(): void {
  tray = new Tray(icon)

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
  ])

  tray.setToolTip('TODO Reminder')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    windowManager?.showAndFocus()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.todo.reminder.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize persistent settings store.
  settingsStore = new SettingsStore()
  const initialSettings = settingsStore.getSettings()

  const dbPath = join(app.getPath('userData'), 'todo-reminder.db')
  repository = new TodoRepository(dbPath)
  windowManager = new WindowManager(join(__dirname, '../preload/index.js'), icon)

  registerIpcHandlers(repository, windowManager, settingsStore, {
    openPomodoroWindow: createPomodoroWindow,
    openSettingsWindow: createSettingsWindow,
    onWindowModeChanged: applyPomodoroMode
  })

  // Restore persisted click-through state.
  if (initialSettings.clickThrough) {
    windowManager.setClickThrough(true)
  }

  // Register shortcut from persisted settings.
  registerClickThroughShortcut(initialSettings.clickThroughShortcut)

  // Settings change side effects.
  settingsStore.onChange((settings) => {
    if (windowManager) {
      if (settings.clickThrough !== windowManager.getClickThrough()) {
        windowManager.setClickThrough(settings.clickThrough)
      }
    }
    broadcastSettingsChanged()
  })

  // Register shortcut changes without triggering a re-register loop.
  let lastShortcut = initialSettings.clickThroughShortcut
  settingsStore.onChange((settings) => {
    if (settings.clickThroughShortcut !== lastShortcut) {
      lastShortcut = settings.clickThroughShortcut
      registerClickThroughShortcut(settings.clickThroughShortcut)
    }

    if (scheduler && settings.reminderAdvanceHours) {
      scheduler.setAdvanceHours(settings.reminderAdvanceHours)
    }
  })

  scheduler = new ReminderScheduler(
    repository,
    () => {
      windowManager?.showAndFocus()
    },
    initialSettings.reminderAdvanceHours
  )
  scheduler.start()

  createMainWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    } else {
      windowManager?.showAndFocus()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  scheduler?.stop()
  repository?.close()
})
