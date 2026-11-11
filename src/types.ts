export type ViewId = 'today' | 'tasks' | 'calendar' | 'notes' | 'focus' | 'habits'
export type Status = 'todo' | 'doing' | 'done'
export type Priority = 0 | 1 | 2 | 3

export interface Project {
  id: string
  name: string
  color: string
}

export interface Schedule {
  date: string
  /** minutes since midnight */
  start: number
  duration: number
}

export type Repeat = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Task {
  id: string
  title: string
  notes: string
  status: Status
  priority: Priority
  due: string | null
  projectId: string | null
  order: number
  createdAt: number
  completedAt: number | null
  schedule: Schedule | null
  repeat?: Repeat | null
  /** minutes spent in focus sessions on this task */
  focusMinutes?: number
  /** id of the follow-up created when a repeating task was completed */
  spawnedId?: string | null
}

export interface CalEvent {
  id: string
  title: string
  date: string
  start: number
  duration: number
  color: string
}

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  updatedAt: number
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  log: Record<string, true>
  createdAt: number
}

export interface FocusSettings {
  work: number
  short: number
  long: number
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  focus: FocusSettings
}

export interface AppData {
  version: 1
  tasks: Task[]
  projects: Project[]
  events: CalEvent[]
  notes: Note[]
  habits: Habit[]
  settings: Settings
  focusLog: Record<string, { sessions: number; minutes: number }>
}
