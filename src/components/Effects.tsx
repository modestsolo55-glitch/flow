import { memo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Info, Trash2 } from 'lucide-react'
import { createStore, useStore } from '../lib/createStore'
import { dismissToast, toasts } from '../lib/toast'
import { dragStore, ghostX, ghostY } from '../lib/dnd'
import { smooth, snappy } from '../lib/motion'
import { ui } from '../store'
import { Glass } from './LiquidGlass'

/* ───────── Wallpaper ───────── */
export const Background = memo(function Background() {
  return (
    <div className="scene" aria-hidden>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
      <div className="scene-noise" />
    </div>
  )
})

export function FocusDim() {
  const on = useStore(ui, (s) => s.focusMode)
  return <motion.div className="focus-dim" initial={false} animate={{ opacity: on ? 0.9 : 0 }} transition={{ duration: 0.6, ease: [0.3, 0, 0.2, 1] }} />
}

/* ───────── Completion glow – a single soft ring, no confetti ───────── */
interface Glow {
  id: number
  x: number
  y: number
  color: string
}
const glows = createStore<Glow[]>([])
let glowId = 0

export function celebrate(el: Element | null, color = 'var(--accent)') {
  if (!el) return
  const r = el.getBoundingClientRect()
  const id = ++glowId
  glows.set((g) => [...g, { id, x: r.left + r.width / 2, y: r.top + r.height / 2, color }])
  window.setTimeout(() => glows.set((g) => g.filter((x) => x.id !== id)), 700)
}

export function ConfettiLayer() {
  const list = useStore(glows, (s) => s)
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {list.map((g) => (
        <motion.span
          key={g.id}
          className="absolute h-8 w-8 rounded-full"
          style={{ left: g.x - 16, top: g.y - 16, boxShadow: `0 0 0 2px ${g.color}, 0 0 14px 2px ${g.color}` }}
          initial={{ scale: 0.7, opacity: 0.55 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>,
    document.body,
  )
}

/* ───────── Toasts ───────── */
const ICONS = { check: Check, trash: Trash2, info: Info }

export function ToastLayer() {
  const list = useStore(toasts, (s) => s)
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[96px] z-[95] flex flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const Icon = ICONS[t.icon]
          return (
            <Glass
              key={t.id}
              radius="full"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
              transition={smooth}
              className="pointer-events-auto flex h-11 max-w-full items-center gap-2.5 pl-4 pr-2 text-[15px]"
            >
              <Icon size={16} strokeWidth={2.4} className="shrink-0 text-label-2" />
              <span className="truncate pr-2">{t.text}</span>
              {t.action && (
                <button
                  className="press relative h-8 shrink-0 rounded-full px-3 font-semibold text-accent"
                  onClick={() => {
                    t.action!.run()
                    dismissToast(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </Glass>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

/* ───────── Drag ghost: a lifted solid card ───────── */
export function DragLayer() {
  const d = useStore(dragStore, (s) => s)
  return createPortal(
    <AnimatePresence>
      {d && (
        <motion.div
          key={d.id}
          className="pointer-events-none fixed left-0 top-0 z-[80]"
          style={{ x: ghostX, y: ghostY, width: d.width, height: d.height, willChange: 'transform' }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
        >
          <motion.div className="relative h-full w-full" initial={{ scale: 1 }} animate={{ scale: d.dropping ? 1 : 1.035 }} transition={snappy}>
            <motion.div
              className="absolute inset-0 rounded-[12px] shadow-[var(--shadow-lift)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: d.dropping ? 0 : 1 }}
              transition={{ duration: 0.2 }}
            />
            <div className="relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-[12px] bg-surface px-3.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate text-[15px] font-medium">{d.title}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
