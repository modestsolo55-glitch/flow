import { createStore } from './createStore'
import { db } from '../store'
import { addFocusToTask, logFocus, toggleTask } from '../actions'
import { toast } from './toast'

export type Phase = 'work' | 'short' | 'long'
export const PHASE_LABEL: Record<Phase, string> = { work: 'Fokus', short: 'Kurze Pause', long: 'Lange Pause' }

export interface TimerState {
  phase: Phase
  running: boolean
  /** timestamp when the running phase ends */
  endAt: number
  /** remaining ms while paused */
  remaining: number
  /** finished focus sessions in the current cycle */
  cycle: number
  /** the task this focus session is for */
  taskId?: string | null
}

const KEY = 'flow:timer:v1'
export const phaseMinutes = (p: Phase) => db.get().settings.focus[p]
export const phaseTotal = (p: Phase) => phaseMinutes(p) * 60_000

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as TimerState
  } catch {
    /* ignore */
  }
  return { phase: 'work', running: false, endAt: 0, remaining: phaseTotal('work'), cycle: 0 }
}

export const timer = createStore<TimerState>(load())
timer.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(timer.get()))
  } catch {
    /* ignore */
  }
})

export const remainingMs = (s = timer.get()) => (s.running ? Math.max(0, s.endAt - Date.now()) : s.remaining)

let audio: AudioContext | null = null
function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* no audio */
  }
}
function chime() {
  if (!audio) return
  const t = audio.currentTime
  ;[659.25, 880, 1318.5].forEach((f, i) => {
    const o = audio!.createOscillator()
    const g = audio!.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t + i * 0.16)
    g.gain.linearRampToValueAtTime(0.18, t + i * 0.16 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 1.2)
    o.connect(g).connect(audio!.destination)
    o.start(t + i * 0.16)
    o.stop(t + i * 0.16 + 1.3)
  })
}

export function setFocusTask(taskId: string | null) {
  timer.set((s) => ({ ...s, taskId }))
}

/** Start a focus session for a specific task. */
export function focusOn(taskId: string) {
  timer.set((s) => ({ ...s, taskId, phase: 'work', running: false, remaining: phaseTotal('work') }))
  startTimer()
}

function notify(title: string, body: string) {
  try {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
  } catch {
    /* notifications unavailable */
  }
}

export function startTimer() {
  unlockAudio()
  // ask once, on a user gesture, so the end of a session can be announced in the background
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    /* ignore */
  }
  timer.set((s) => (s.running ? s : { ...s, running: true, endAt: Date.now() + (s.remaining || phaseTotal(s.phase)) }))
}
export function pauseTimer() {
  timer.set((s) => (s.running ? { ...s, running: false, remaining: Math.max(0, s.endAt - Date.now()) } : s))
}
export function resetTimer() {
  timer.set((s) => ({ ...s, running: false, remaining: phaseTotal(s.phase) }))
}
export function setPhase(phase: Phase) {
  timer.set((s) => ({ ...s, phase, running: false, remaining: phaseTotal(phase) }))
}

function advance(natural: boolean) {
  const s = timer.get()
  let cycle = s.cycle
  let next: Phase
  const task = s.taskId ? db.get().tasks.find((t) => t.id === s.taskId && t.status !== 'done') : undefined
  if (s.phase === 'work') {
    if (natural) {
      logFocus(phaseMinutes('work'))
      if (task) addFocusToTask(task.id, phaseMinutes('work'))
      cycle = s.cycle + 1
    }
    next = cycle > 0 && cycle % 4 === 0 && natural ? 'long' : 'short'
  } else {
    next = 'work'
  }
  timer.set(() => ({ phase: next, running: false, endAt: 0, remaining: phaseTotal(next), cycle, taskId: task ? task.id : null }))
  if (natural) {
    chime()
    if (s.phase === 'work') {
      notify('Fokus-Session beendet', task ? `«${task.title}» – Zeit für eine Pause.` : 'Zeit für eine Pause.')
      if (task) toast(`Session beendet. «${task.title}» erledigt?`, 'check', { label: 'Erledigt', run: () => (toggleTask(task.id), setFocusTask(null)) })
      else toast('Session beendet – Zeit für eine Pause', 'check')
    } else {
      notify('Pause vorbei', 'Bereit für die nächste Runde?')
      toast('Pause vorbei – bereit für die nächste Runde?', 'check')
    }
  }
}

export const skipPhase = () => advance(false)

/** Completes the phase if its time is up. Safe to call any time. */
export function finishIfDue() {
  const s = timer.get()
  if (s.running && Date.now() >= s.endAt) advance(true)
}

/** Keep the paused remaining time in sync when durations change. */
let lastFocus = db.get().settings.focus
db.subscribe(() => {
  const focus = db.get().settings.focus
  if (focus === lastFocus) return
  const prevTotal = lastFocus[timer.get().phase] * 60_000
  lastFocus = focus
  const s = timer.get()
  if (s.running) return
  const total = phaseTotal(s.phase)
  if (s.remaining === prevTotal || s.remaining > total || s.remaining === 0) timer.set((x) => ({ ...x, remaining: total }))
})
