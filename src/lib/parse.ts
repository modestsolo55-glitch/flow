import type { Priority, Project } from '../types'
import { addDaysKey, todayKey, weekdayIndex } from './date'
import { norm } from './utils'

export interface Parsed {
  title: string
  due: string | null
  priority: Priority
  projectId: string | null
  time: number | null
}

const WEEKDAYS = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag']

function nextWeekday(name: string) {
  const t = todayKey()
  const idx = WEEKDAYS.indexOf(name.toLowerCase())
  const diff = (idx - weekdayIndex(t) + 7) % 7 || 7
  return addDaysKey(t, diff)
}

/**
 * Natural-language quick entry:
 *  "Bericht schreiben morgen 14:00 !1 #arbeit"
 */
export function parseQuick(input: string, projects: Project[]): Parsed {
  let s = ` ${input} `
  let due: string | null = null
  let priority: Priority = 0
  let projectId: string | null = null
  let time: number | null = null
  const today = todayKey()

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = s.match(re)
    if (m && fn(m) !== false) s = s.replace(m[0], ' ')
  }

  take(/\s(heute)(?=\s)/i, () => void (due = today))
  take(/\s(übermorgen|uebermorgen)(?=\s)/i, () => void (due = addDaysKey(today, 2)))
  take(/\s(morgen)(?=\s)/i, () => void (due = addDaysKey(today, 1)))
  take(/\s(nächste woche|naechste woche)(?=\s)/i, () => void (due = addDaysKey(today, 7)))
  take(/\s(?:am\s)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?=\s)/i, (m) => void (due = nextWeekday(m[1])))
  take(/\s(?:um\s)?(\d{1,2})(?::(\d{2}))?\s?uhr(?=\s)/i, (m) => {
    const h = +m[1]
    const mi = m[2] ? +m[2] : 0
    if (h > 23 || mi > 59) return false
    time = h * 60 + mi
  })
  take(/\s(?:um\s)?(\d{1,2}):(\d{2})(?=\s)/, (m) => {
    const h = +m[1]
    const mi = +m[2]
    if (h > 23 || mi > 59) return false
    time = h * 60 + mi
  })
  take(/\s!(1|hoch)(?=\s)/i, () => void (priority = 3))
  take(/\s!(2|mittel)(?=\s)/i, () => void (priority = 2))
  take(/\s!(3|niedrig)(?=\s)/i, () => void (priority = 1))
  take(/\s#([^\s#]+)/, (m) => {
    const q = norm(m[1])
    const p = projects.find((p) => norm(p.name).replace(/\s+/g, '').startsWith(q))
    if (!p) return false
    projectId = p.id
  })

  if (time !== null && !due) due = today
  return { title: s.replace(/\s+/g, ' ').trim(), due, priority, projectId, time }
}
