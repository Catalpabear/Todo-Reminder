import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi, PomodoroNotificationInput } from '../shared/ipc';
import type { TodoInput, TodoUpdateInput, WindowMode } from '../shared/todo';

const api: DesktopApi = {
  createTodo: (input: TodoInput) => ipcRenderer.invoke('createTodo', input),
  getTodos: () => ipcRenderer.invoke('getTodos'),
  updateTodo: (input: TodoUpdateInput) => ipcRenderer.invoke('updateTodo', input),
  deleteTodo: (id: number) => ipcRenderer.invoke('deleteTodo', id),
  markNotified: (id: number) => ipcRenderer.invoke('markNotified', id),

  setWindowMode: (mode: WindowMode) => ipcRenderer.invoke('setWindowMode', mode),
  getWindowMode: () => ipcRenderer.invoke('getWindowMode'),

  setClickThrough: (enabled: boolean) => ipcRenderer.invoke('setClickThrough', enabled),
  getClickThrough: () => ipcRenderer.invoke('getClickThrough'),

  minimizeWindow: () => ipcRenderer.invoke('minimizeWindow'),
  closeWindow: () => ipcRenderer.invoke('closeWindow'),
  openPomodoroWindow: () => ipcRenderer.invoke('openPomodoroWindow'),

  getAutoLaunch: () => ipcRenderer.invoke('getAutoLaunch'),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('setAutoLaunch', enabled),
  notifyPomodoroDone: (input: PomodoroNotificationInput) => ipcRenderer.invoke('notifyPomodoroDone', input),

  onWindowModeChanged: (callback: (mode: WindowMode) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, mode: WindowMode): void => {
      callback(mode);
    };

    ipcRenderer.on('windowModeChanged', listener);

    return () => {
      ipcRenderer.removeListener('windowModeChanged', listener);
    };
  },

  onClickThroughChanged: (callback: (enabled: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean): void => {
      callback(enabled);
    };

    ipcRenderer.on('clickThroughChanged', listener);

    return () => {
      ipcRenderer.removeListener('clickThroughChanged', listener);
    };
  }
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  // @ts-ignore runtime fallback for contextIsolation disabled.
  window.api = api;
}
