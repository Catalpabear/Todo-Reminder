import type { Todo, TodoInput, TodoUpdateInput, WindowMode } from './todo';

export interface DesktopApi {
  createTodo: (input: TodoInput) => Promise<Todo>;
  getTodos: () => Promise<Todo[]>;
  updateTodo: (input: TodoUpdateInput) => Promise<Todo | null>;
  deleteTodo: (id: number) => Promise<boolean>;
  markNotified: (id: number) => Promise<boolean>;

  setWindowMode: (mode: WindowMode) => Promise<WindowMode>;
  getWindowMode: () => Promise<WindowMode>;

  setClickThrough: (enabled: boolean) => Promise<boolean>;
  getClickThrough: () => Promise<boolean>;

  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  onWindowModeChanged: (callback: (mode: WindowMode) => void) => () => void;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
}
