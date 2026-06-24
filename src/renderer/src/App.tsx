import { useCallback, useEffect, useMemo, useState, useRef } from 'react'

import type { JSX } from 'react'

import type { AppSettings } from '../../shared/settings'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import type { Todo, WindowMode } from '../../shared/todo'

import TodoForm, { mapTodoToInitialForm } from './components/TodoForm'
import TodoItem from './components/TodoItem'

type FormPayload = {
  title: string
  description: string
  deadline: number
}

const defaultForm = {
  title: '',
  description: '',
  deadline: ''
}

function toLocalDateTimeInputValue(timestamp: number): string {
  const target = new Date(timestamp)
  const shifted = new Date(target.getTime() - target.getTimezoneOffset() * 60 * 1000)
  return shifted.toISOString().slice(0, 16)
}

function computeAutoFillDeadline(autoFillHours: number | null): string {
  if (!autoFillHours || autoFillHours <= 0) {
    return ''
  }

  return toLocalDateTimeInputValue(Date.now() + autoFillHours * 60 * 60 * 1000)
}

export default function App(): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null)
  const [editingForm, setEditingForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<WindowMode>('forever')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [error, setError] = useState<string | null>(null)

  const loadTodos = useCallback(async (): Promise<void> => {
    try {
      const list = await window.api.getTodos()
      setTodos(list)
    } catch {
      setError('读取 TODO 失败，请重试。')
    }
  }, [])

  useEffect(() => {
    void loadTodos()

    void window.api.getWindowMode().then(setMode)
    void window.api.getSettings().then(setSettings)

    const unsubscribeWindowMode = window.api.onWindowModeChanged((nextMode) => {
      setMode(nextMode)
    })

    const unsubscribeSettings = window.api.onSettingsChanged((nextSettings) => {
      setSettings(nextSettings)
    })

    return () => {
      unsubscribeWindowMode()
      unsubscribeSettings()
    }
  }, [loadTodos])

  const handleCreate = async (payload: FormPayload): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      await window.api.createTodo(payload)
      await loadTodos()
    } catch {
      setError('创建 TODO 失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (payload: FormPayload): Promise<void> => {
    if (editingTodoId === null) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await window.api.updateTodo({ id: editingTodoId, ...payload })
      setEditingTodoId(null)
      setEditingForm(defaultForm)
      await loadTodos()
    } catch {
      setError('更新 TODO 失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    setError(null)

    try {
      await window.api.deleteTodo(id)
      if (editingTodoId === id) {
        setEditingTodoId(null)
        setEditingForm(defaultForm)
      }
      await loadTodos()
    } catch {
      setError('删除 TODO 失败。')
    }
  }

  const handleMarkNotified = async (id: number): Promise<void> => {
    setError(null)

    try {
      await window.api.markNotified(id)
      await loadTodos()
    } catch {
      setError('更新提醒状态失败。')
    }
  }

  const handleEdit = (todo: Todo): void => {
    setEditingTodoId(todo.id)
    setEditingForm(mapTodoToInitialForm(todo))
    open()
    handleScrollToTarget()
  }

  const cancelEdit = (): void => {
    setEditingTodoId(null)
    setEditingForm(defaultForm)
    close()
  }

  const switchMode = async (nextMode: WindowMode): Promise<void> => {
    const result = await window.api.setWindowMode(nextMode)
    setMode(result)
  }

  const editing = useMemo(
    () =>
      editingTodoId === null ? null : (todos.find((todo) => todo.id === editingTodoId) ?? null),
    [editingTodoId, todos]
  )

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const open = () => {
    if (detailsRef.current) {
      detailsRef.current.open = true
    }
  }
  const close = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false
    }
  }
  const handleScrollToTarget = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const autoFillDeadline = useMemo(
    () => computeAutoFillDeadline(settings.autoFillDeadlineHours),
    [settings.autoFillDeadlineHours]
  )

  return (
    <div className="window-root">
      <div className="app-shell">
        <header className="title-bar drag-region">
          <div>
            <p className="small">Desktop TODO Reminder</p>
            <h1>任务提醒</h1>
          </div>
          <div className="window-buttons no-drag">
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
          </div>
        </header>

        <section className="toolbar no-drag">
          <div className="toolbar-actions">
            <button
              type="button"
              className="ghost toolbar-button"
              onClick={() => window.api.openPomodoroWindow()}
            >
              番茄钟
            </button>
            <button
              type="button"
              className="ghost toolbar-button"
              onClick={() => window.api.openSettingsWindow()}
            >
              设置
            </button>
            <button
              type="button"
              className="danger toolbar-button"
              onClick={() => window.api.closeWindow()}
            >
              Exit
            </button>
          </div>
        </section>

        <details ref={detailsRef}>
          <summary>点击展开新建TODO界面</summary>
          <section className="panel no-drag">
            <h2>{editing ? '编辑 TODO' : '新建 TODO'}</h2>
            <TodoForm
              submitLabel={editing ? '保存修改' : '创建任务'}
              initialTitle={editing ? editingForm.title : ''}
              initialDescription={editing ? editingForm.description : ''}
              initialDeadline={editing ? editingForm.deadline : autoFillDeadline}
              onSubmit={editing ? handleUpdate : handleCreate}
              onCancelEdit={editing ? cancelEdit : undefined}
              loading={loading}
              close={close}
            />
          </section>
        </details>

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
      </div>
    </div>
  )
}
