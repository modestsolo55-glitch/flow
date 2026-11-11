import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './store'
import {
  addEvent,
  addHabit,
  addProject,
  addTask,
  autoPlanToday,
  deleteProject,
  deleteTasks,
  freeSlots,
  importData,
  moveTask,
  restoreTasks,
  scheduleTask,
  toggleHabit,
  toggleTask,
  updateTask,
} from './actions'
import { createEmptyData } from './lib/sample'
import { parseQuick } from './lib/parse'
import { addDaysKey, diffDays, nextOccurrence, relativeDay, todayKey, weekDays } from './lib/date'
import { completionRate, currentStreak, longestStreak } from './lib/habits'

// Wednesday, 11 November 2026, 10:00
const NOW = new Date(2026, 10, 11, 10, 0, 0)
const T = '2026-11-11'
const tasks = () => db.get().tasks
const task = (title: string) => tasks().find((t) => t.title === title)!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  db.set(() => createEmptyData('light'))
})

describe('Datum', () => {
  it('kennt heute, morgen und Wochentage', () => {
    expect(todayKey()).toBe(T)
    expect(relativeDay(T)).toBe('Heute')
    expect(relativeDay(addDaysKey(T, 1))).toBe('Morgen')
    expect(relativeDay(addDaysKey(T, -1))).toBe('Gestern')
    expect(weekDays(T)[0]).toBe('2026-11-09') // Montag
    expect(diffDays('2026-11-14', T)).toBe(3)
  })

  it('berechnet die nächste Wiederholung', () => {
    expect(nextOccurrence(T, 'daily')).toBe('2026-11-12')
    expect(nextOccurrence('2026-11-13', 'weekdays')).toBe('2026-11-16') // Fr → Mo
    expect(nextOccurrence(T, 'weekly')).toBe('2026-11-18')
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextOccurrence('2028-01-31', 'monthly')).toBe('2028-02-29')
  })
})

describe('Schnelleingabe', () => {
  const projects = () => db.get().projects

  it('erkennt Datum, Zeit, Priorität und Liste', () => {
    const p = parseQuick('Bericht senden morgen 14:00 !1 #arbeit', projects())
    expect(p.title).toBe('Bericht senden')
    expect(p.due).toBe('2026-11-12')
    expect(p.time).toBe(14 * 60)
    expect(p.priority).toBe(3)
    expect(p.projectId).toBe(projects().find((x) => x.name === 'Arbeit')!.id)
  })

  it('erkennt Wochentage und «Uhr»', () => {
    expect(parseQuick('Zahnarzt freitag', projects()).due).toBe('2026-11-13')
    expect(parseQuick('Zahnarzt mittwoch', projects()).due).toBe('2026-11-18') // heute Mittwoch → nächste Woche
    const p = parseQuick('Call um 9 Uhr', projects())
    expect(p.time).toBe(9 * 60)
    expect(p.due).toBe(T) // Zeit ohne Datum = heute
  })

  it('lässt Unbekanntes im Titel', () => {
    const p = parseQuick('Ticket #1234 prüfen', projects())
    expect(p.title).toBe('Ticket #1234 prüfen')
    expect(p.projectId).toBeNull()
    expect(parseQuick('Übermorgen erledigen übermorgen', projects()).due).toBe('2026-11-13')
    expect(parseQuick('Termin 25:00', projects()).time).toBeNull()
  })
})

describe('Aufgaben', () => {
  it('abhaken setzt und löscht den Erledigt-Zeitpunkt', () => {
    addTask({ title: 'A' })
    toggleTask(task('A').id)
    expect(task('A').status).toBe('done')
    expect(task('A').completedAt).not.toBeNull()
    toggleTask(task('A').id)
    expect(task('A').status).toBe('todo')
    expect(task('A').completedAt).toBeNull()
  })

  it('wiederholende Aufgabe erzeugt beim Abhaken die nächste – und nimmt sie beim Zurücknehmen wieder weg', () => {
    addTask({ title: 'Vitamine', due: T, repeat: 'daily' })
    const id = task('Vitamine').id
    toggleTask(id)
    const all = tasks().filter((t) => t.title === 'Vitamine')
    expect(all).toHaveLength(2)
    const next = all.find((t) => t.status === 'todo')!
    expect(next.due).toBe('2026-11-12')
    expect(next.repeat).toBe('daily')
    toggleTask(id) // aus Versehen abgehakt
    const back = tasks().filter((t) => t.title === 'Vitamine')
    expect(back).toHaveLength(1)
    expect(back[0].repeat).toBe('daily')
  })

  it('überfällige tägliche Aufgabe springt nicht in die Vergangenheit', () => {
    addTask({ title: 'Alt', due: '2026-11-01', repeat: 'daily' })
    toggleTask(task('Alt').id)
    const next = tasks().find((t) => t.title === 'Alt' && t.status === 'todo')!
    expect((next.due ?? '') >= T).toBe(true)
  })

  it('Board: in «Erledigt» ziehen verhält sich wie Abhaken (inkl. Wiederholung)', () => {
    addTask({ title: 'Woche', due: T, repeat: 'weekly' })
    moveTask(task('Woche').id, 'done', 0)
    const all = tasks().filter((t) => t.title === 'Woche')
    expect(all.map((t) => t.status).sort()).toEqual(['done', 'todo'])
    expect(all.find((t) => t.status === 'done')!.completedAt).not.toBeNull()
    expect(all.find((t) => t.status === 'todo')!.due).toBe('2026-11-18')
  })

  it('Board: Reihenfolge in einer Spalte', () => {
    addTask({ title: 'C' })
    addTask({ title: 'B' })
    addTask({ title: 'A' })
    moveTask(task('C').id, 'todo', 0)
    const order = tasks().filter((t) => t.status === 'todo').sort((a, b) => a.order - b.order).map((t) => t.title)
    expect(order).toEqual(['C', 'A', 'B'])
  })

  it('einplanen setzt Datum, löschen und wiederherstellen', () => {
    addTask({ title: 'Plan' })
    scheduleTask(task('Plan').id, T, 14 * 60)
    expect(task('Plan').schedule).toEqual({ date: T, start: 840, duration: 60 })
    expect(task('Plan').due).toBe(T)
    const removed = deleteTasks([task('Plan').id])
    expect(task('Plan')).toBeUndefined()
    restoreTasks(removed)
    expect(task('Plan').title).toBe('Plan')
  })

  it('Status über Details ändern', () => {
    addTask({ title: 'S' })
    updateTask(task('S').id, { status: 'doing' })
    expect(task('S').status).toBe('doing')
    expect(task('S').completedAt).toBeNull()
  })
})

describe('Tagesplan', () => {
  it('findet freie Lücken zwischen Terminen', () => {
    addEvent({ title: 'Meeting', date: T, start: 11 * 60, duration: 60, color: '#007aff' })
    addEvent({ title: 'Lunch', date: T, start: 12 * 60 + 30, duration: 60, color: '#007aff' })
    expect(freeSlots(T, 10 * 60, 18 * 60, 30)).toEqual([
      [600, 660],
      [720, 750],
      [810, 1080],
    ])
  })

  it('plant offene Aufgaben ohne Überschneidung ein und lässt sich widerrufen', () => {
    addEvent({ title: 'Meeting', date: T, start: 11 * 60, duration: 120, color: '#007aff' })
    addTask({ title: 'Wichtig', due: T, priority: 3 })
    addTask({ title: 'Klein', due: T })
    addTask({ title: 'Morgen', due: addDaysKey(T, 1) })
    const r = autoPlanToday()
    expect(r.count).toBe(2)
    const w = task('Wichtig').schedule!
    const k = task('Klein').schedule!
    expect(task('Morgen').schedule).toBeNull()
    expect(w.duration).toBe(60) // hohe Priorität bekommt mehr Zeit
    const overlaps = (a: number, b: number, c: number, d: number) => a < d && c < b
    for (const s of [w, k]) {
      expect(s.start).toBeGreaterThanOrEqual(10 * 60)
      expect(overlaps(s.start, s.start + s.duration, 11 * 60, 13 * 60)).toBe(false)
    }
    expect(overlaps(w.start, w.start + w.duration, k.start, k.start + k.duration)).toBe(false)
    r.undo()
    expect(task('Wichtig').schedule).toBeNull()
  })
})

describe('Gewohnheiten', () => {
  it('Serie, Rekord und Quote', () => {
    const log: Record<string, true> = {}
    for (let i = 0; i < 5; i++) log[addDaysKey(T, -i)] = true // heute + 4 Tage zurück
    log[addDaysKey(T, -10)] = true
    expect(currentStreak(log, T)).toBe(5)
    expect(longestStreak(log)).toBe(5)
    expect(completionRate(log, T, 10)).toBeCloseTo(0.5)
    // heute noch nicht erledigt: Serie von gestern zählt weiter
    const y: Record<string, true> = { [addDaysKey(T, -1)]: true, [addDaysKey(T, -2)]: true }
    expect(currentStreak(y, T)).toBe(2)
  })

  it('abhaken und zurücknehmen', () => {
    const id = addHabit({ name: 'Lesen', icon: 'book', color: '#af52de' })
    toggleHabit(id)
    expect(db.get().habits[0].log[T]).toBe(true)
    toggleHabit(id)
    expect(db.get().habits[0].log[T]).toBeUndefined()
  })
})

describe('Listen und Daten', () => {
  it('Liste löschen behält ihre Aufgaben', () => {
    const p = addProject('Reise', '#30b0c7')
    addTask({ title: 'Koffer', projectId: p })
    deleteProject(p)
    expect(db.get().projects.find((x) => x.id === p)).toBeUndefined()
    expect(task('Koffer').projectId).toBeNull()
  })

  it('Backup wiederherstellen prüft die Datei', async () => {
    const file = (s: string) => ({ text: async () => s }) as unknown as File
    expect(await importData(file('kein json'))).toBe(false)
    expect(await importData(file(JSON.stringify({ version: 2 })))).toBe(false)
    addTask({ title: 'Vorher' })
    const backup = JSON.stringify({ ...createEmptyData(), tasks: [] })
    expect(await importData(file(backup))).toBe(true)
    expect(tasks()).toHaveLength(0)
  })
})

describe('Notizen', () => {
  it('leere Notiz verschwindet beim Wechsel, gefüllte bleibt', async () => {
    const { addNote, selectNote, updateNote, navigate } = await import('./actions')
    navigate('notes')
    const empty = addNote()
    selectNote(empty)
    const kept = addNote()
    selectNote(kept)
    expect(db.get().notes.some((n) => n.id === empty)).toBe(false)
    updateNote(kept, { title: 'Bleibt' })
    navigate('today')
    expect(db.get().notes.some((n) => n.id === kept)).toBe(true)
  })
})
