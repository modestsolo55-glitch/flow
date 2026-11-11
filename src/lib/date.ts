const LOCALE = 'de-CH'

export const pad = (n: number) => String(n).padStart(2, '0')
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayKey = () => toKey(new Date())
export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const addDaysKey = (k: string, n: number) => toKey(addDays(fromKey(k), n))
export const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
export const weekDays = (k: string) => {
  const s = startOfWeek(fromKey(k))
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(s, i)))
}
/** a - b in days */
export const diffDays = (a: string, b: string) => Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000)
export const fmtTime = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`
export const fmtDate = (k: string, opts: Intl.DateTimeFormatOptions) => fromKey(k).toLocaleDateString(LOCALE, opts)
export const nowMinutes = () => {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export const weekdayIndex = (k: string) => (fromKey(k).getDay() + 6) % 7

export function relativeDay(k: string): string {
  const d = diffDays(k, todayKey())
  if (d === 0) return 'Heute'
  if (d === 1) return 'Morgen'
  if (d === -1) return 'Gestern'
  if (d > 1 && d < 7) return fmtDate(k, { weekday: 'long' })
  if (d < 0 && d > -7) return `vor ${-d} Tagen`
  return fmtDate(k, { day: 'numeric', month: 'short' })
}

export function isoWeek(k: string) {
  const d = fromKey(k)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 14) return 'Schönen Mittag'
  if (h < 18) return 'Guten Nachmittag'
  return 'Guten Abend'
}

export function nextOccurrence(from: string, repeat: 'daily' | 'weekdays' | 'weekly' | 'monthly'): string {
  const d = fromKey(from)
  if (repeat === 'daily') d.setDate(d.getDate() + 1)
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
  else if (repeat === 'weekdays') {
    do d.setDate(d.getDate() + 1)
    while (d.getDay() === 0 || d.getDay() === 6)
  } else {
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  }
  return toKey(d)
}

export const REPEAT_LABEL = { daily: 'Täglich', weekdays: 'An Werktagen', weekly: 'Wöchentlich', monthly: 'Monatlich' } as const
