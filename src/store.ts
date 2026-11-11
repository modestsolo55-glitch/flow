import type { AppData, ViewId } from './types'
import { createStore } from './lib/createStore'
import { createSampleData } from './lib/sample'

export const DATA_KEY = 'flow:data:v2'
const VIEW_KEY = 'flow:view'

/** true on the very first launch – Flow then asks how you want to start */
export let firstRun = false

function load(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) firstRun = true
    if (raw) {
      const d = JSON.parse(raw) as AppData
      if (d && d.version === 1 && Array.isArray(d.tasks)) return d
    }
  } catch {
    /* ignore corrupt storage */
  }
  return createSampleData()
}

/** Persistent app data (tasks, notes, …) */
export const db = createStore<AppData>(load())

let saveTimer: number | undefined
const flush = () => {
  window.clearTimeout(saveTimer)
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(db.get()))
  } catch {
    /* quota or private mode – keep running in memory */
  }
}
db.subscribe(() => {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(flush, 250)
})
window.addEventListener('pagehide', flush)
window.addEventListener('beforeunload', flush)
flush()

/** Ephemeral UI state */
export type SheetType = 'task' | 'event'
export interface UIState {
  view: ViewId
  commandOpen: boolean
  create: { open: boolean; type: SheetType; preset?: { date?: string; start?: number; due?: string | null; projectId?: string | null } }
  editTask: string | null
  editEvent: string | null
  habitAdd: boolean
  settingsOpen: boolean
  welcome: boolean
  focusMode: boolean
  noteId: string | null
}

const VIEWS: ViewId[] = ['today', 'tasks', 'calendar', 'notes', 'focus', 'habits']
function loadView(): ViewId {
  try {
    const v = localStorage.getItem(VIEW_KEY) as ViewId | null
    if (v && VIEWS.includes(v)) return v
  } catch {
    /* ignore */
  }
  return 'today'
}

export const ui = createStore<UIState>({
  view: loadView(),
  commandOpen: false,
  create: { open: false, type: 'task' },
  editTask: null,
  editEvent: null,
  habitAdd: false,
  settingsOpen: false,
  welcome: firstRun,
  focusMode: false,
  noteId: null,
})

ui.subscribe(() => {
  try {
    localStorage.setItem(VIEW_KEY, ui.get().view)
  } catch {
    /* ignore */
  }
})
