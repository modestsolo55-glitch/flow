import './e2e' // must run before anything else is imported
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './lib/theme'
import { initCloud } from './lib/cloud'
import './index.css'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Shared claude.ai page: keep each signed-in person's data in their private space.
void initCloud()

// Installable + offline when served as a website (not for the single file or the shared page).
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http') && window.top === window) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
