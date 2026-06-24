import { Notification, app, ipcMain } from 'electron'

import type { AppSettings } from '../../shared/settings'
import type { PomodoroNotificationInput } from '../../shared/ipc'
import type { TodoInput, TodoUpdateInput, WindowMode } from '../../shared/todo'
import { TodoRepository } from '../database/todoRepository'
import { SettingsStore } from '../settings/settingsStore'
import { WindowManager } from '../window/windowManager'

type IpcActions = {
  openPomodoroWindow: () => void
  openSettingsWindow: () => void
  onWindowModeChanged?: (mode: WindowMode) => void
}

export function registerIpcHandlers(
  repository: TodoRepository,
  windowManager: WindowManager,
  settingsStore: SettingsStore,
  actions: IpcActions
): void {
  const register = <T>(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, payload: T) => unknown
  ): void => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, handler)
  }

  register<TodoInput>('createTodo', (_, payload) => repository.createTodo(payload))
  register<void>('getTodos', () => repository.getTodos())
  register<TodoUpdateInput>('updateTodo', (_, payload) => repository.updateTodo(payload))
  register<number>('deleteTodo', (_, id) => repository.deleteTodo(id))
  register<number>('markNotified', (_, id) => repository.markNotified(id))

  register<WindowMode>('setWindowMode', (_, mode) => {
    const nextMode = windowManager.setMode(mode)
    actions.onWindowModeChanged?.(nextMode)
    return nextMode
  })
  register<void>('getWindowMode', () => windowManager.getMode())

  register<boolean>('setClickThrough', (_, enabled) => {
    settingsStore.updateSettings({ clickThrough: enabled })
    return windowManager.setClickThrough(enabled)
  })
  register<void>('getClickThrough', () => settingsStore.getSettings().clickThrough)

  register<boolean>('setAutoLaunch', (_, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
    settingsStore.updateSettings({ autoLaunch: enabled })
    return app.getLoginItemSettings().openAtLogin
  })
  register<void>('getAutoLaunch', () => settingsStore.getSettings().autoLaunch)

  register<void>('openPomodoroWindow', () => {
    actions.openPomodoroWindow()
  })

  register<void>('openSettingsWindow', () => {
    actions.openSettingsWindow()
  })

  register<Partial<AppSettings>>('updateSettings', (_, partial) => {
    return settingsStore.updateSettings(partial)
  })

  register<void>('getSettings', () => {
    return settingsStore.getSettings()
  })

  register<PomodoroNotificationInput>('notifyPomodoroDone', (_, payload) => {
    if (!Notification.isSupported()) {
      return
    }

    const label = payload.presetName
      ? `「${payload.presetName}」`
      : `${payload.durationMinutes} 分钟`
    new Notification({
      title: '番茄钟时间到',
      body: `${label} 已完成，休息一下吧。`
    }).show()
  })

  register<void>('minimizeWindow', () => {
    windowManager.minimize()
  })

  register<void>('closeWindow', () => {
    windowManager.close()
  })
}
