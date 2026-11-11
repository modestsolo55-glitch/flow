import type { AppData, CalEvent, FocusSettings, Habit, Note, Project, Status, Task, ViewId } from './types'
import { db, ui, type SheetType, type UIState } from './store'
import { nextOccurrence, todayKey } from './lib/date'
import { uid } from './lib/utils'
import { createEmptyData, createSampleData } from './lib/sample'
import { saveFile } from './lib/save'

const patch = (fn: (d: AppData) => Partial<AppData>) => db.set((s) => ({ ...s, ...fn(s) }))
const byOrder = (a: Task, b: Task) => a.order - b.order

/* ───────── Tasks ───────── */

export function addTask(p: Partial<Task> & { title: string }): string {
  const id = uid()
  patch((s) => {
    let min = 0
    for (const t of s.tasks) if (t.order < min) min = t.order
    const task: Task = {
      id,
      notes: '',
      status: 'todo',
      priority: 0,
      due: null,
      projectId: null,
      createdAt: Date.now(),
      completedAt: null,
      schedule: null,
      ...p,
      order: min - 1,
    }
    return { tasks: [task, ...s.tasks] }
  })
  return id
}

export function updateTask(id: string, p: Partial<Task>) {
  patch((s) => {
    const t = s.tasks.find((x) => x.id === id)
    if (!t) return {}
    const next: Task = { ...t, ...p }
    let tasks = s.tasks
    let spawn: Task | null = null
    if (p.status && p.status !== t.status) {
      next.completedAt = p.status === 'done' ? Date.now() : null
      // Repeating task completed → the next occurrence appears right away.
      if (p.status === 'done' && next.repeat) {
        const today = todayKey()
        let due = nextOccurrence(next.due ?? today, next.repeat)
        while (due < today) due = nextOccurrence(due, next.repeat)
        spawn = {
          ...next,
          id: uid(),
          status: 'todo',
          completedAt: null,
          due,
          schedule: next.schedule ? { ...next.schedule, date: due } : null,
          focusMinutes: 0,
          spawnedId: null,
          createdAt: Date.now(),
        }
        next.spawnedId = spawn.id
        next.repeat = null
      }
      // Re-opened by mistake → take the untouched follow-up back.
      if (p.status !== 'done' && t.status === 'done' && t.spawnedId) {
        const child = s.tasks.find((x) => x.id === t.spawnedId)
        if (child && child.status === 'todo') {
          tasks = tasks.filter((x) => x.id !== child.id)
          next.repeat = child.repeat
        }
        next.spawnedId = null
      }
    }
    tasks = tasks.map((x) => (x.id === id ? next : x))
    return { tasks: spawn ? [spawn, ...tasks] : tasks }
  })
}

export function addFocusToTask(id: string, minutes: number) {
  patch((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, focusMinutes: (t.focusMinutes ?? 0) + minutes } : t)) }))
}

/** Busy intervals of a day (events + time-blocked tasks), sorted. */
export function busyIntervals(date: string, s = db.get()) {
  return [
    ...s.events.filter((e) => e.date === date).map((e) => [e.start, e.start + e.duration] as const),
    ...s.tasks.filter((t) => t.status !== 'done' && t.schedule?.date === date).map((t) => [t.schedule!.start, t.schedule!.start + t.schedule!.duration] as const),
  ].sort((a, b) => a[0] - b[0])
}

/** Free gaps between now and the end of the working day. */
export function freeSlots(date: string, from: number, until = 20 * 60, minLen = 30, s = db.get()) {
  const slots: [number, number][] = []
  let cursor = from
  for (const [a, b] of busyIntervals(date, s)) {
    if (b <= cursor) continue
    if (a - cursor >= minLen) slots.push([cursor, Math.min(a, until)])
    cursor = Math.max(cursor, b)
    if (cursor >= until) break
  }
  if (until - cursor >= minLen) slots.push([cursor, until])
  return slots.filter(([a, b]) => b - a >= minLen)
}

/**
 * Puts today's open, unscheduled tasks into the free gaps of the day –
 * most important first. Returns the previous schedules for undo.
 */
export function autoPlanToday(): { count: number; undo: () => void } {
  const s = db.get()
  const t = todayKey()
  const now = new Date()
  const from = Math.max(8 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes() + 5) / 15) * 15)
  const todo = s.tasks
    .filter((x) => x.status !== 'done' && !x.schedule && x.due && x.due <= t)
    .sort((a, b) => b.priority - a.priority || (a.due ?? '').localeCompare(b.due ?? '') || a.order - b.order)
  const slots = freeSlots(t, from, 20 * 60, 15, s)
  const plan = new Map<string, { date: string; start: number; duration: number }>()
  for (const task of todo) {
    const len = task.priority >= 3 ? 60 : 30
    const slot = slots.find(([a, b]) => b - a >= len)
    if (!slot) continue
    plan.set(task.id, { date: t, start: slot[0], duration: len })
    slot[0] += len + 5 // a little breathing room between blocks
  }
  if (!plan.size) return { count: 0, undo: () => {} }
  patch((d) => ({ tasks: d.tasks.map((x) => (plan.has(x.id) ? { ...x, schedule: plan.get(x.id)! } : x)) }))
  return {
    count: plan.size,
    undo: () => patch((d) => ({ tasks: d.tasks.map((x) => (plan.has(x.id) ? { ...x, schedule: null } : x)) })),
  }
}

export function toggleTask(id: string) {
  const t = db.get().tasks.find((x) => x.id === id)
  if (!t) return
  updateTask(id, { status: t.status === 'done' ? 'todo' : 'done' })
}

export function deleteTask(id: string): Task | undefined {
  const t = db.get().tasks.find((x) => x.id === id)
  patch((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }))
  return t
}

export function restoreTask(t: Task) {
  patch((s) => ({ tasks: [t, ...s.tasks] }))
}

/** Move a task into a kanban column at a given index and re-number the column. */
export function moveTask(id: string, status: Status, index: number) {
  // status changes go through updateTask so completion time and repeats behave the same everywhere
  const before = db.get().tasks.find((t) => t.id === id)
  if (before && before.status !== status) updateTask(id, { status })
  patch((s) => {
    const task = s.tasks.find((t) => t.id === id)
    if (!task) return {}
    const moved: Task = { ...task, status }
    const col = s.tasks.filter((t) => t.status === status && t.id !== id).sort(byOrder)
    col.splice(Math.max(0, Math.min(index, col.length)), 0, moved)
    const order = new Map(col.map((t, i) => [t.id, i]))
    return {
      tasks: s.tasks.map((t) => {
        const o = order.get(t.id)
        if (o === undefined) return t
        const base = t.id === id ? moved : t
        return base.order === o && base === t ? t : { ...base, order: o }
      }),
    }
  })
}

export function scheduleTask(id: string, date: string, start: number) {
  patch((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === id
        ? { ...t, due: t.due ?? date, schedule: { date, start, duration: t.schedule?.duration ?? 60 } }
        : t,
    ),
  }))
}

export function unscheduleTask(id: string) {
  updateTask(id, { schedule: null })
}

/* ───────── Events ───────── */

export function addEvent(e: Omit<CalEvent, 'id'>) {
  const id = uid()
  patch((s) => ({ events: [...s.events, { ...e, id }] }))
  return id
}
export function updateEvent(id: string, p: Partial<CalEvent>) {
  patch((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...p } : e)) }))
}
export function moveEvent(id: string, date: string, start: number) {
  updateEvent(id, { date, start })
}
export function deleteEvent(id: string) {
  const e = db.get().events.find((x) => x.id === id)
  patch((s) => ({ events: s.events.filter((x) => x.id !== id) }))
  return e
}
export function restoreEvent(e: CalEvent) {
  patch((s) => ({ events: [...s.events, e] }))
}

/* ───────── Notes ───────── */

export function addNote(p: Partial<Note> = {}) {
  const id = uid()
  patch((s) => ({ notes: [{ id, title: '', body: '', pinned: false, updatedAt: Date.now(), ...p }, ...s.notes] }))
  return id
}
export function updateNote(id: string, p: Partial<Note>) {
  patch((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...p, updatedAt: Date.now() } : n)) }))
}
export function togglePin(id: string) {
  patch((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) }))
}
export function deleteNote(id: string) {
  const n = db.get().notes.find((x) => x.id === id)
  patch((s) => ({ notes: s.notes.filter((x) => x.id !== id) }))
  return n
}
export function restoreNote(n: Note) {
  patch((s) => ({ notes: [n, ...s.notes] }))
}

/* ───────── Habits ───────── */

export function addHabit(h: Pick<Habit, 'name' | 'icon' | 'color'>) {
  const id = uid()
  patch((s) => ({ habits: [...s.habits, { ...h, id, log: {}, createdAt: Date.now() }] }))
  return id
}
export function toggleHabit(id: string, date = todayKey()) {
  patch((s) => ({
    habits: s.habits.map((h) => {
      if (h.id !== id) return h
      const log = { ...h.log }
      if (log[date]) delete log[date]
      else log[date] = true
      return { ...h, log }
    }),
  }))
}
export function deleteHabit(id: string) {
  const h = db.get().habits.find((x) => x.id === id)
  patch((s) => ({ habits: s.habits.filter((x) => x.id !== id) }))
  return h
}
export function restoreHabit(h: Habit) {
  patch((s) => ({ habits: [...s.habits, h] }))
}

/* ───────── Settings / Focus ───────── */

export function setThemeValue(theme: AppData['settings']['theme']) {
  patch((s) => ({ settings: { ...s.settings, theme } }))
}
export function setFocusSetting(key: keyof FocusSettings, minutes: number) {
  patch((s) => ({ settings: { ...s.settings, focus: { ...s.settings.focus, [key]: minutes } } }))
}
export function logFocus(minutes: number) {
  const k = todayKey()
  patch((s) => {
    const cur = s.focusLog[k] ?? { sessions: 0, minutes: 0 }
    return { focusLog: { ...s.focusLog, [k]: { sessions: cur.sessions + 1, minutes: cur.minutes + minutes } } }
  })
}
export function resetDemo() {
  db.set((s) => createSampleData(s.settings.theme))
}

/* ───────── UI ───────── */

const setUI = (p: Partial<UIState>) => ui.set((s) => ({ ...s, ...p }))

export function navigate(view: ViewId) {
  if (view !== ui.get().view && ui.get().view === 'notes') {
    dropEmptyNote()
    setUI({ noteId: null })
  }
  ui.set((s) => (s.view === view ? s : { ...s, view, focusMode: false }))
}
export function openCommand() {
  setUI({ commandOpen: true })
}
export function closeCommand() {
  setUI({ commandOpen: false })
}
export function openCreate(type: SheetType = 'task', preset?: UIState['create']['preset']) {
  setUI({ create: { open: true, type, preset } })
}
export function closeCreate() {
  ui.set((s) => ({ ...s, create: { ...s.create, open: false } }))
}
export function openTask(id: string) {
  setUI({ editTask: id })
}
export function closeTask() {
  setUI({ editTask: null })
}
export function openEvent(id: string) {
  setUI({ editEvent: id })
}
export function closeEvent() {
  setUI({ editEvent: null })
}
export function setHabitAdd(open: boolean) {
  setUI({ habitAdd: open })
}
export function setFocusMode(on: boolean) {
  ui.set((s) => (s.focusMode === on ? s : { ...s, focusMode: on }))
}
/** Like Apple Notes: a note left completely empty disappears when you move on. */
function dropEmptyNote(except?: string | null) {
  const prev = ui.get().noteId
  if (!prev || prev === except) return
  const n = db.get().notes.find((x) => x.id === prev)
  if (n && !n.title.trim() && !n.body.trim()) patch((s) => ({ notes: s.notes.filter((x) => x.id !== prev) }))
}

export function selectNote(id: string | null) {
  dropEmptyNote(id)
  setUI({ noteId: id })
}

/** "New" always creates the thing that belongs to where you are. */
export function createInContext() {
  const v = ui.get().view
  if (v === 'calendar') openCreate('event')
  else if (v === 'notes') selectNote(addNote())
  else if (v === 'habits') setHabitAdd(true)
  else openCreate('task', v === 'today' ? { due: todayKey() } : undefined)
}

/* ───────── Lists (projects) ───────── */

export function addProject(name: string, color: string) {
  const id = uid()
  patch((s) => ({ projects: [...s.projects, { id, name, color }] }))
  return id
}
export function updateProject(id: string, p: Partial<Project>) {
  patch((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
}
/** Deleting a list keeps its tasks – they just lose the list. */
export function deleteProject(id: string) {
  patch((s) => ({ projects: s.projects.filter((x) => x.id !== id), tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)) }))
}

/* ───────── Data ───────── */

export function exportData() {
  return saveFile(`flow-backup-${todayKey()}.json`, JSON.stringify(db.get(), null, 2))
}

export async function importData(file: File): Promise<boolean> {
  try {
    const d = JSON.parse(await file.text()) as AppData
    if (d?.version !== 1 || !Array.isArray(d.tasks) || !Array.isArray(d.projects)) return false
    db.set(() => ({ ...createEmptyData(), ...d }))
    return true
  } catch {
    return false
  }
}

export function startEmpty() {
  db.set((s) => createEmptyData(s.settings.theme))
}

export function setSettingsOpen(open: boolean) {
  ui.set((s) => ({ ...s, settingsOpen: open }))
}
export function closeWelcome() {
  ui.set((s) => ({ ...s, welcome: false }))
}

/** Remove several tasks at once (e.g. "Erledigte löschen"); returns them for undo. */
export function deleteTasks(ids: string[]): Task[] {
  const set = new Set(ids)
  const removed = db.get().tasks.filter((t) => set.has(t.id))
  patch((s) => ({ tasks: s.tasks.filter((t) => !set.has(t.id)) }))
  return removed
}
export function restoreTasks(list: Task[]) {
  patch((s) => ({ tasks: [...list, ...s.tasks] }))
}
