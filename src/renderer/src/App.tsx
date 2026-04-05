import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Todo, WindowMode } from '../../shared/todo';

import TodoForm, { mapTodoToInitialForm } from './components/TodoForm';
import TodoItem from './components/TodoItem';

type FormPayload = {
  title: string;
  description: string;
  deadline: number;
};

const defaultForm = {
  title: '',
  description: '',
  deadline: ''
};

export default function App(): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<WindowMode>('forever');
  const [clickThrough, setClickThrough] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTodos = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.getTodos();
      setTodos(list);
    } catch {
      setError('读取 TODO 失败，请重试。');
    }
  }, []);

  useEffect(() => {
    void loadTodos();

    void window.api.getWindowMode().then(setMode);
    void window.api.getClickThrough().then(setClickThrough);

    const unsubscribe = window.api.onWindowModeChanged((nextMode) => {
      setMode(nextMode);
    });

    return () => {
      unsubscribe();
    };
  }, [loadTodos]);

  const handleCreate = async (payload: FormPayload): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await window.api.createTodo(payload);
      await loadTodos();
    } catch {
      setError('创建 TODO 失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (payload: FormPayload): Promise<void> => {
    if (editingTodoId === null) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await window.api.updateTodo({ id: editingTodoId, ...payload });
      setEditingTodoId(null);
      setEditingForm(defaultForm);
      await loadTodos();
    } catch {
      setError('更新 TODO 失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    setError(null);

    try {
      await window.api.deleteTodo(id);
      if (editingTodoId === id) {
        setEditingTodoId(null);
        setEditingForm(defaultForm);
      }
      await loadTodos();
    } catch {
      setError('删除 TODO 失败。');
    }
  };

  const handleMarkNotified = async (id: number): Promise<void> => {
    setError(null);

    try {
      await window.api.markNotified(id);
      await loadTodos();
    } catch {
      setError('更新提醒状态失败。');
    }
  };

  const handleEdit = (todo: Todo): void => {
    setEditingTodoId(todo.id);
    setEditingForm(mapTodoToInitialForm(todo));
  };

  const cancelEdit = (): void => {
    setEditingTodoId(null);
    setEditingForm(defaultForm);
  };

  const switchMode = async (nextMode: WindowMode): Promise<void> => {
    const result = await window.api.setWindowMode(nextMode);
    setMode(result);
  };

  const toggleClickThrough = async (): Promise<void> => {
    const result = await window.api.setClickThrough(!clickThrough);
    setClickThrough(result);
  };

  const editing = useMemo(
    () => (editingTodoId === null ? null : todos.find((todo) => todo.id === editingTodoId) ?? null),
    [editingTodoId, todos]
  );

  return (
    <div className="window-root">
      <div className="app-shell">
        <header className="title-bar drag-region">
          <div>
            <p className="small">Desktop TODO Reminder</p>
            <h1>任务提醒</h1>
          </div>
          <div className="window-buttons no-drag">
            <button type="button" className="ghost" onClick={() => window.api.minimizeWindow()}>
              最小化
            </button>
            <button type="button" className="danger" onClick={() => window.api.closeWindow()}>
              关闭
            </button>
          </div>
        </header>

        <section className="toolbar no-drag">
          <div className="mode-switch">
            <button
              type="button"
              className={mode === 'forever' ? 'active' : ''}
              onClick={() => void switchMode('forever')}
            >
              Forever Mode
            </button>
            <button
              type="button"
              className={mode === 'desktop' ? 'active' : ''}
              onClick={() => void switchMode('desktop')}
            >
              Desktop Mode
            </button>
          </div>

          <label className="click-toggle">
            <input type="checkbox" checked={clickThrough} onChange={() => void toggleClickThrough()} />
            Click-through
          </label>
        </section>

        <section className="panel no-drag">
          <h2>{editing ? '编辑 TODO' : '新建 TODO'}</h2>
          <TodoForm
            submitLabel={editing ? '保存修改' : '创建任务'}
            initialTitle={editing ? editingForm.title : ''}
            initialDescription={editing ? editingForm.description : ''}
            initialDeadline={editing ? editingForm.deadline : ''}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancelEdit={editing ? cancelEdit : undefined}
            loading={loading}
          />
        </section>

        <section className="panel list-panel no-drag">
          <div className="panel-header">
            <h2>任务列表</h2>
            <span>{todos.length} 条</span>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="todo-list">
            {todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMarkNotified={handleMarkNotified}
              />
            ))}
            {todos.length === 0 ? <p className="empty-tip">暂无任务，创建一个吧。</p> : null}
          </div>
        </section>

        <footer className="footer no-drag">
          <span>通知规则：截止前 5 小时触发（每分钟检查）</span>
          <span>快捷键：Ctrl/Cmd + Shift + X 切换穿透</span>
        </footer>
      </div>
    </div>
  );
}
