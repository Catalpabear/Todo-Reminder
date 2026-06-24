export interface AppSettings {
  autoLaunch: boolean
  clickThrough: boolean
  clickThroughShortcut: string
  autoFillDeadlineHours: number | null
  reminderAdvanceHours: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLaunch: false,
  clickThrough: false,
  clickThroughShortcut: 'Alt+X',
  autoFillDeadlineHours: null,
  reminderAdvanceHours: 5
}
