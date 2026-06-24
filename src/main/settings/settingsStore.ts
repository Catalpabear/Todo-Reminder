import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { AppSettings } from '../../shared/settings'
import { DEFAULT_SETTINGS } from '../../shared/settings'

export class SettingsStore {
  private filePath: string
  private settings: AppSettings
  private listeners: Array<(s: AppSettings) => void> = []

  constructor() {
    this.filePath = join(app.getPath('userData'), 'settings.json')
    this.settings = this.load()
  }

  getSettings(): AppSettings {
    return { ...this.settings }
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial }
    this.save()
    const snapshot = this.getSettings()
    for (const cb of this.listeners) {
      cb(snapshot)
    }
    return snapshot
  }

  onChange(cb: (s: AppSettings) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  private load(): AppSettings {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch {
      // File corrupted or unreadable — fall through to defaults.
    }
    return { ...DEFAULT_SETTINGS }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
    } catch {
      // Best effort — settings will still be in memory for this session.
    }
  }
}
