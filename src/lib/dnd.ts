import type { PointerEvent as ReactPointerEvent } from 'react'
import { animate, motionValue } from 'framer-motion'
import type { Status } from '../types'
import { createStore } from './createStore'
import { moveEvent, moveTask, scheduleTask, unscheduleTask } from '../actions'

/**
 * Pointer-driven drag & drop shared by the Kanban board and the calendar.
 * The dragged item is rendered as a floating "ghost" whose position lives in
 * motion values (no React re-render per pointer move). React only re-renders
 * when the drop target changes, so the other items can make room smoothly.
 */

export type DropTarget =
  | { zone: 'kanban'; col: Status; index: number }
  | { zone: 'cal'; date: string; start: number }
  | { zone: 'backlog' }

export interface DragInfo {
  id: string
  type: 'task' | 'event'
  title: string
  color: string
  width: number
  height: number
  duration: number
  over: DropTarget | null
  dropping: boolean
}

export const dragStore = createStore<DragInfo | null>(null)
export const ghostX = motionValue(0)
export const ghostY = motionValue(0)

let lastDrop = { id: '', t: 0 }
export const wasJustDropped = (id: string) => lastDrop.id === id && performance.now() - lastDrop.t < 700

const sameTarget = (a: DropTarget | null, b: DropTarget | null) => {
  if (a === b) return true
  if (!a || !b || a.zone !== b.zone) return false
  if (a.zone === 'kanban' && b.zone === 'kanban') return a.col === b.col && a.index === b.index
  if (a.zone === 'cal' && b.zone === 'cal') return a.date === b.date && a.start === b.start
  return true
}

function hitTest(x: number, y: number, g: { top: number; height: number; duration: number }): DropTarget | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const zone = el?.closest<HTMLElement>('[data-drop]')
  if (!zone) return null
  const kind = zone.dataset.drop
  if (kind === 'kanban') {
    const list = zone.querySelector<HTMLElement>('[data-list]') ?? zone
    const cy = g.top + g.height / 2 - list.getBoundingClientRect().top
    // offsetTop ignores transforms → stable while siblings are mid-animation
    const cards = Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-card]'))
    let index = cards.length
    for (let i = 0; i < cards.length; i++) {
      if (cy < cards[i].offsetTop + cards[i].offsetHeight / 2) {
        index = i
        break
      }
    }
    return { zone: 'kanban', col: zone.dataset.col as Status, index }
  }
  if (kind === 'cal') {
    const r = zone.getBoundingClientRect()
    const startH = Number(zone.dataset.start)
    const endH = Number(zone.dataset.end)
    const hourH = Number(zone.dataset.hourh)
    let m = startH * 60 + ((g.top - r.top) / hourH) * 60
    m = Math.round(m / 15) * 15
    m = Math.max(startH * 60, Math.min(endH * 60 - Math.max(15, g.duration), m))
    return { zone: 'cal', date: zone.dataset.date!, start: m }
  }
  if (kind === 'backlog') return { zone: 'backlog' }
  return null
}

function performDrop(d: DragInfo) {
  const o = d.over
  if (!o) return
  if (o.zone === 'kanban' && d.type === 'task') moveTask(d.id, o.col, o.index)
  else if (o.zone === 'cal') d.type === 'task' ? scheduleTask(d.id, o.date, o.start) : moveEvent(d.id, o.date, o.start)
  else if (o.zone === 'backlog' && d.type === 'task') unscheduleTask(d.id)
}

function suppressNextClick() {
  const h = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', h, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', h, { capture: true }), 60)
}

const SETTLE = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.8 }
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export interface DragSource {
  id: string
  type: 'task' | 'event'
  title: string
  color: string
  duration?: number
}

export function startDrag(e: ReactPointerEvent<HTMLElement>, src: DragSource) {
  if (e.button !== 0 || dragStore.get()) return
  if ((e.target as HTMLElement).closest('[data-nodrag],button,input,textarea,a')) return

  const el = e.currentTarget
  const sx = e.clientX
  const sy = e.clientY
  const isTouch = e.pointerType !== 'mouse'
  let active = false
  let timer = 0
  let raf = 0
  let lastX = sx
  let lastY = sy
  let offX = 0
  let offY = 0
  let origin = { left: 0, top: 0 }

  const update = () => {
    ghostX.set(lastX - offX)
    ghostY.set(lastY - offY)
    const cur = dragStore.get()
    if (!cur || cur.dropping) return
    const over = hitTest(lastX, lastY, { top: lastY - offY, height: cur.height, duration: cur.duration })
    if (!sameTarget(over, cur.over)) dragStore.set(() => ({ ...cur, over }))
  }

  // Edge auto-scroll for the nearest scroll container under the pointer
  const autoScroll = () => {
    raf = requestAnimationFrame(autoScroll)
    const under = document.elementFromPoint(lastX, lastY) as HTMLElement | null
    const sc = under?.closest<HTMLElement>('[data-autoscroll]')
    if (!sc) return
    const r = sc.getBoundingClientRect()
    const edge = 56
    let dy = 0
    if (lastY < r.top + edge) dy = -((r.top + edge - lastY) / edge) * 14
    else if (lastY > r.bottom - edge) dy = ((lastY - (r.bottom - edge)) / edge) * 14
    if (dy) {
      sc.scrollTop += dy
      update()
    }
  }

  const begin = () => {
    active = true
    const r = el.getBoundingClientRect()
    origin = { left: r.left, top: r.top }
    offX = sx - r.left
    offY = sy - r.top
    dragStore.set(() => ({
      id: src.id,
      type: src.type,
      title: src.title,
      color: src.color,
      width: r.width,
      height: r.height,
      duration: src.duration ?? 60,
      over: null,
      dropping: false,
    }))
    document.body.classList.add('is-dragging')
    if (isTouch) navigator.vibrate?.(8) // haptic tick when a card lifts – phones only
    update()
    raf = requestAnimationFrame(autoScroll)
  }

  const cleanup = () => {
    window.clearTimeout(timer)
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('contextmenu', onContext)
    document.body.classList.remove('is-dragging')
  }

  const settle = (x: number, y: number, then: () => void) => {
    if (reduced()) return then()
    let done = 0
    const fin = () => ++done === 2 && then()
    animate(ghostX, x, { ...SETTLE, onComplete: fin })
    animate(ghostY, y, { ...SETTLE, onComplete: fin })
  }

  const drop = () => {
    const cur = dragStore.get()
    if (!cur) return
    const finish = (commit: boolean) => {
      if (commit) {
        performDrop(cur)
        lastDrop = { id: cur.id, t: performance.now() }
      }
      dragStore.set(() => null)
    }
    if (!cur.over) {
      dragStore.set(() => ({ ...cur, dropping: true }))
      return settle(origin.left, origin.top, () => finish(false))
    }
    dragStore.set(() => ({ ...cur, dropping: true }))
    const ph = document.querySelector<HTMLElement>('[data-placeholder]')
    if (!ph) return finish(true)
    const r = ph.getBoundingClientRect()
    settle(r.left, r.top, () => finish(true))
  }

  function onMove(ev: PointerEvent) {
    lastX = ev.clientX
    lastY = ev.clientY
    if (!active) {
      const dist = Math.hypot(lastX - sx, lastY - sy)
      if (isTouch) {
        if (dist > 8) cleanup() // user is scrolling
      } else if (dist > 4) begin()
      return
    }
    update()
  }
  function onUp() {
    const was = active
    cleanup()
    if (was) {
      suppressNextClick()
      drop()
    }
  }
  function onCancel() {
    const was = active
    cleanup()
    if (was) dragStore.set(() => null)
  }
  function onTouchMove(ev: TouchEvent) {
    if (active) ev.preventDefault()
  }
  function onContext(ev: Event) {
    if (active || isTouch) ev.preventDefault()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('contextmenu', onContext)
  if (isTouch) timer = window.setTimeout(begin, 260) // long-press to lift on touch
}
