import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../shared/ipc';
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

  onWindowModeChanged: (callback: (mode: WindowMode) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, mode: WindowMode): void => {
      callback(mode);
    };

    ipcRenderer.on('windowModeChanged', listener);

    return () => {
      ipcRenderer.removeListener('windowModeChanged', listener);
    };
  }
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  // @ts-expect-error runtime fallback for contextIsolation disabled.
  window.api = api;
}
