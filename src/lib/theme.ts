import { flushSync } from 'react-dom'
import { setThemeValue } from '../actions'
import { db } from '../store'
import type { Settings } from '../types'

type Mode = Settings['theme']
const META = { light: '#f2f2f7', dark: '#000000' }
const sysDark = () => {
  const host = document.documentElement.dataset.theme // set by the claude.ai viewer when the visitor picked a theme
  return host === 'dark' ? true : host === 'light' ? false : matchMedia('(prefers-color-scheme: dark)').matches
}
export const resolve = (m: Mode) => (m === 'system' ? (sysDark() ? 'dark' : 'light') : m)

function applyClass(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme])
}

export function initTheme() {
  applyClass(resolve(db.get().settings.theme))
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (db.get().settings.theme === 'system') transition(() => applyClass(resolve('system')))
  })
}

function transition(apply: () => void, origin?: { x: number; y: number }) {
  const root = document.documentElement
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
  if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-anim')
    apply()
    window.setTimeout(() => root.classList.remove('theme-anim'), 450)
    return
  }
  const x = origin?.x ?? innerWidth / 2
  const y = origin?.y ?? innerHeight / 2
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  doc
    .startViewTransition(apply)
    .ready.then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.3,.7,.2,1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => {})
}

/** Changes the appearance; animates with a circular reveal from the click point. */
export function setAppearance(mode: Mode, origin?: { x: number; y: number }) {
  const before = resolve(db.get().settings.theme)
  const after = resolve(mode)
  const apply = () => {
    applyClass(after)
    flushSync(() => setThemeValue(mode))
  }
  if (before === after) return apply()
  transition(apply, origin)
}

export function toggleTheme(origin?: { x: number; y: number }) {
  setAppearance(resolve(db.get().settings.theme) === 'dark' ? 'light' : 'dark', origin)
}
