import { useCallback, useEffect, useState } from 'react'

import type { JSX } from 'react'

import type { AppSettings } from '../../shared/settings'
import { DEFAULT_SETTINGS } from '../../shared/settings'

const SHORTCUT_SUGGESTIONS = ['Alt+X', 'Alt+Z', 'Ctrl+Shift+X', 'CommandOrControl+Shift+X']

export default function SettingsWindow(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [shortcutInput, setShortcutInput] = useState(DEFAULT_SETTINGS.clickThroughShortcut)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [autoFillInput, setAutoFillInput] = useState(
    DEFAULT_SETTINGS.autoFillDeadlineHours !== null
      ? String(DEFAULT_SETTINGS.autoFillDeadlineHours)
      : ''
  )
  const [autoFillEnabled, setAutoFillEnabled] = useState(
    DEFAULT_SETTINGS.autoFillDeadlineHours !== null
  )
  const [reminderInput, setReminderInput] = useState(String(DEFAULT_SETTINGS.reminderAdvanceHours))

  const persist = useCallback(async (partial: Partial<AppSettings>): Promise<void> => {
    try {
      const updated = await window.api.updateSettings(partial)
      setSettings(updated)
    } catch {
      // Silently ignore — settings store handles errors internally.
    }
  }, [])

  useEffect(() => {
    void window.api.getSettings().then((s) => {
      setSettings(s)
      setShortcutInput(s.clickThroughShortcut)
      setAutoFillEnabled(s.autoFillDeadlineHours !== null)
      setAutoFillInput(s.autoFillDeadlineHours !== null ? String(s.autoFillDeadlineHours) : '')
      setReminderInput(String(s.reminderAdvanceHours))
    })

    const unsubscribe = window.api.onSettingsChanged((s) => {
      setSettings(s)
      setShortcutInput(s.clickThroughShortcut)
      setAutoFillEnabled(s.autoFillDeadlineHours !== null)
      setAutoFillInput(s.autoFillDeadlineHours !== null ? String(s.autoFillDeadlineHours) : '')
      setReminderInput(String(s.reminderAdvanceHours))
      setShortcutError(null)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const handleShortcutSave = (value: string): void => {
    setShortcutError(null)
    const trimmed = value.trim()
    setShortcutInput(trimmed)

    if (!trimmed) {
      setShortcutError('快捷键不能为空')
      setShortcutInput(settings.clickThroughShortcut)
      return
    }

    void persist({ clickThroughShortcut: trimmed }).then(() => {
      void window.api.getSettings().then((s) => {
        if (s.clickThroughShortcut !== trimmed) {
          setShortcutError('快捷键注册失败，已恢复为默认值')
          setShortcutInput(s.clickThroughShortcut)
        }
      })
    })
  }

  const handleShortcutKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    // Ignore standalone modifier keys.
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(event.key)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const parts: string[] = []

    if (event.metaKey) {
      parts.push('CommandOrControl')
    } else if (event.ctrlKey) {
      parts.push('Ctrl')
    }

    if (event.altKey) {
      parts.push('Alt')
    }

    if (event.shiftKey) {
      parts.push('Shift')
    }

    // Map special keys to Electron accelerator tokens.
    const key = event.key
    const upperKey = key.length === 1 ? key.toUpperCase() : key
    parts.push(upperKey)

    const accelerator = parts.join('+')
    setShortcutInput(accelerator)
    handleShortcutSave(accelerator)
  }

  const handleAutoFillChange = (enabled: boolean, hoursStr: string): void => {
    setAutoFillEnabled(enabled)
    setAutoFillInput(hoursStr)

    if (!enabled) {
      void persist({ autoFillDeadlineHours: null })
      return
    }

    const hours = parseFloat(hoursStr)
    if (Number.isNaN(hours) || hours <= 0 || !hoursStr) {
      // Enabling with no valid value — default to 2 hours.
      const defaultHours = 2
      setAutoFillInput(String(defaultHours))
      void persist({ autoFillDeadlineHours: defaultHours })
      return
    }

    void persist({ autoFillDeadlineHours: hours })
  }

  const handleReminderChange = (hoursStr: string): void => {
    setReminderInput(hoursStr)
    const hours = parseFloat(hoursStr)
    if (Number.isNaN(hours) || hours <= 0) {
      void persist({ reminderAdvanceHours: DEFAULT_SETTINGS.reminderAdvanceHours })
      setReminderInput(String(DEFAULT_SETTINGS.reminderAdvanceHours))
      return
    }
    void persist({ reminderAdvanceHours: hours })
  }

  return (
    <div className="settings-root">
      <div className="settings-shell">
        <header className="settings-header drag-region">
          <p className="small">Todo-Reminder</p>
          <h1>设置</h1>
        </header>

        <section className="settings-body no-drag">
          <div className="settings-section">
            <div className="settings-row">
              <label className="settings-label">
                <span>开机自启动</span>
                <span className="settings-hint">系统启动时自动运行本应用</span>
              </label>
              <input
                type="checkbox"
                checked={settings.autoLaunch}
                onChange={(event) => void persist({ autoLaunch: event.target.checked })}
              />
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-row">
              <label className="settings-label">
                <span>鼠标穿透</span>
                <span className="settings-hint">开启后鼠标事件穿透窗口，无法点击窗口内元素</span>
              </label>
              <input
                type="checkbox"
                checked={settings.clickThrough}
                onChange={(event) => void persist({ clickThrough: event.target.checked })}
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">
                <span>穿透快捷键</span>
                <span className="settings-hint">用于快速切换鼠标穿透状态的全局快捷键</span>
              </label>
              <div className="settings-shortcut-wrap">
                <input
                  type="text"
                  className="settings-shortcut-input"
                  value={shortcutInput}
                  onChange={(event) => setShortcutInput(event.target.value)}
                  onKeyDown={handleShortcutKeyDown}
                  onBlur={(event) => handleShortcutSave(event.target.value)}
                  placeholder="点击后按下组合键..."
                  spellCheck={false}
                  readOnly
                />
                {shortcutError ? <p className="error-text">{shortcutError}</p> : null}
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-row">
              <label className="settings-label">
                <span>自动填充截止时间</span>
                <span className="settings-hint">
                  新建 TODO 时，自动将截止时间设为当前时间 + N 小时
                </span>
              </label>
              <div className="settings-inline-controls">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoFillEnabled}
                    onChange={(event) => handleAutoFillChange(event.target.checked, autoFillInput)}
                  />
                  启用
                </label>
                <input
                  type="number"
                  className="settings-number-input"
                  value={autoFillInput}
                  onChange={(event) => handleAutoFillChange(autoFillEnabled, event.target.value)}
                  min="0.5"
                  step="0.5"
                  placeholder="小时"
                  disabled={!autoFillEnabled}
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-row">
              <label className="settings-label">
                <span>截止时间前自动提醒</span>
                <span className="settings-hint">在截止时间前 N 小时触发系统通知（每分钟检查）</span>
              </label>
              <div className="settings-inline-controls">
                <input
                  type="number"
                  className="settings-number-input"
                  value={reminderInput}
                  onChange={(event) => handleReminderChange(event.target.value)}
                  min="0.5"
                  step="0.5"
                />
                <span className="settings-unit">小时</span>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-footer no-drag">
          <button type="button" className="ghost" onClick={() => window.close()}>
            关闭
          </button>
        </section>
      </div>
    </div>
  )
}
