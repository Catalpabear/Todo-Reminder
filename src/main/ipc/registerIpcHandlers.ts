import { ipcMain } from 'electron';

import type { TodoInput, TodoUpdateInput, WindowMode } from '../../shared/todo';
import { TodoRepository } from '../database/todoRepository';
import { WindowManager } from '../window/windowManager';

export function registerIpcHandlers(repository: TodoRepository, windowManager: WindowManager): void {
  const register = <T>(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, payload: T) => unknown
  ): void => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  };

  register<TodoInput>('createTodo', (_, payload) => repository.createTodo(payload));
  register<void>('getTodos', () => repository.getTodos());
  register<TodoUpdateInput>('updateTodo', (_, payload) => repository.updateTodo(payload));
  register<number>('deleteTodo', (_, id) => repository.deleteTodo(id));
  register<number>('markNotified', (_, id) => repository.markNotified(id));

  register<WindowMode>('setWindowMode', (_, mode) => windowManager.setMode(mode));
  register<void>('getWindowMode', () => windowManager.getMode());

  register<boolean>('setClickThrough', (_, enabled) => windowManager.setClickThrough(enabled));
  register<void>('getClickThrough', () => windowManager.getClickThrough());

  register<void>('minimizeWindow', () => {
    windowManager.minimize();
  });

  register<void>('closeWindow', () => {
    windowManager.close();
  });
}
