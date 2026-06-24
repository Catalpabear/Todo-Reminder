import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import PomodoroWindow from './PomodoroWindow'
import SettingsWindow from './SettingsWindow'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    {window.location.hash === '#pomodoro' ? (
      <PomodoroWindow />
    ) : window.location.hash === '#settings' ? (
      <SettingsWindow />
    ) : (
      <App />
    )}
  </StrictMode>
)
