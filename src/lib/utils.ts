export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** lowercases and strips diacritics so "Persönlich" matches "personlich" */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
export const modKey = isMac ? '⌘' : 'Ctrl'

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'Keine',
  1: 'Niedrig',
  2: 'Mittel',
  3: 'Hoch',
}

export const PALETTE = ['#007aff', '#ff2d55', '#34c759', '#ff9500', '#af52de', '#30b0c7', '#5856d6', '#ff3b30']
