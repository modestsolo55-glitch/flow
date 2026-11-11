import { addDaysKey, diffDays } from './date'

export function currentStreak(log: Record<string, true>, today: string) {
  let d = log[today] ? today : addDaysKey(today, -1)
  let n = 0
  while (log[d]) {
    n++
    d = addDaysKey(d, -1)
  }
  return n
}

export function longestStreak(log: Record<string, true>) {
  const keys = Object.keys(log).sort()
  let best = 0
  let cur = 0
  let prev: string | null = null
  for (const k of keys) {
    cur = prev && diffDays(k, prev) === 1 ? cur + 1 : 1
    if (cur > best) best = cur
    prev = k
  }
  return best
}

export function completionRate(log: Record<string, true>, today: string, days = 30) {
  let c = 0
  for (let i = 0; i < days; i++) if (log[addDaysKey(today, -i)]) c++
  return c / days
}
