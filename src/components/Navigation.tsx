import { memo, useContext, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useAnimationFrame, useScroll, useTransform } from 'framer-motion'
import { CalendarDays, CircleCheck, Flame, NotebookPen, Search, Settings, SunMedium, Timer as TimerIcon, type LucideIcon } from 'lucide-react'
import type { ViewId } from '../types'
import { useStore } from '../lib/createStore'
import { db, ui } from '../store'
import { navigate, openCommand, setSettingsOpen } from '../actions'
import { diffDays, fmtClock, todayKey } from '../lib/date'
import { PHASE_LABEL, phaseTotal, remainingMs, timer } from '../lib/timer'
import { ScrollContext } from '../lib/hooks'
import { cn, modKey } from '../lib/utils'
import { smooth, snappy } from '../lib/motion'
import { Glass, GlassButton, jelly, LiquidPill } from './ui'
import logoUrl from '../assets/logo.svg'

export const NAV: { id: ViewId; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'today', label: 'Heute', icon: SunMedium, color: 'var(--orange)' },
  { id: 'tasks', label: 'Aufgaben', icon: CircleCheck, color: 'var(--accent)' },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays, color: 'var(--red)' },
  { id: 'notes', label: 'Notizen', icon: NotebookPen, color: 'var(--yellow)' },
  { id: 'focus', label: 'Fokus', icon: TimerIcon, color: 'var(--indigo)' },
  { id: 'habits', label: 'Gewohnheiten', icon: Flame, color: 'var(--green)' },
]

function useCounts() {
  const tasks = useStore(db, (s) => s.tasks)
  const habits = useStore(db, (s) => s.habits)
  return useMemo(() => {
    const t = todayKey()
    return {
      today: tasks.filter((x) => x.status !== 'done' && x.due && diffDays(x.due, t) <= 0).length,
      tasks: tasks.filter((x) => x.status !== 'done').length,
      habits: habits.filter((h) => !h.log[t]).length,
    } as Partial<Record<ViewId, number>>
  }, [tasks, habits])
}

/** Re-renders nothing: writes the remaining time straight into the DOM, only while mounted. */
function Countdown() {
  const ref = useRef<HTMLSpanElement>(null)
  useAnimationFrame(() => {
    if (!ref.current) return
    const t = fmtClock(remainingMs())
    if (ref.current.textContent !== t) ref.current.textContent = t
  })
  return <span ref={ref} className="block text-[14px] font-semibold tabular-nums" />
}

/** Running timer pill – text written per frame, no re-render. */
function FocusMini() {
  const s = useStore(timer, (x) => x)
  const view = useStore(ui, (x) => x.view)
  const active = s.running || s.remaining < phaseTotal(s.phase)
  return (
    <AnimatePresence>
      {active && view !== 'focus' && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={smooth}
          onClick={() => navigate('focus')}
          className="press relative mb-1 flex h-11 items-center justify-center gap-2.5 rounded-[12px] bg-fill-2 px-2.5 lg:justify-start"
        >
          <TimerIcon size={17} className={s.running ? 'text-ios-orange' : 'text-label-2'} />
          <span className="hidden min-w-0 text-left lg:block">
            <span className="block text-[11px] leading-3 text-label-2">{PHASE_LABEL[s.phase]}{s.running ? '' : ' · Pause'}</span>
            <Countdown />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export const Sidebar = memo(function Sidebar() {
  const view = useStore(ui, (s) => s.view)
  const focusMode = useStore(ui, (s) => s.focusMode)
  const counts = useCounts()

  return (
    <motion.div
      className="fixed bottom-3 left-3 top-3 z-30 hidden md:block"
      initial={false}
      animate={focusMode ? { x: -40, opacity: 0 } : { x: 0, opacity: 1 }}
      transition={smooth}
      style={{ pointerEvents: focusMode ? 'none' : 'auto' }}
    >
      <Glass radius={26} interactive className="flex h-full w-[68px] flex-col px-2 pb-2 pt-3 lg:w-[236px]">
        <div className="mb-3 flex items-center justify-center gap-2 lg:justify-start lg:px-2">
          <img src={logoUrl} alt="" className="h-7 w-7 rounded-[8px]" />
          <span className="hidden text-[15px] font-semibold lg:inline">Flow</span>
        </div>

        <button
          onClick={openCommand}
          className="mb-3 flex h-9 items-center justify-center gap-2 rounded-full bg-fill px-3 text-[14px] text-label-2 lg:justify-start"
          aria-label="Suchen"
        >
          <Search size={15} className="shrink-0" />
          <span className="hidden flex-1 text-left lg:block">Suchen</span>
          <span className="hidden text-[12px] lg:inline">{modKey}K</span>
        </button>

        <nav className="flex flex-col gap-0.5" aria-label="Bereiche">
          {NAV.map((n) => {
            const active = view === n.id
            const count = counts[n.id]
            return (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                aria-current={active ? 'page' : undefined}
                title={n.label}
                className="press relative flex h-9 items-center justify-center gap-2.5 rounded-full px-3 text-[14px] outline-none lg:justify-start"
              >
                {active && (
                  <motion.span
                    layoutId="nav-sel"
                    className="lg-pill absolute inset-0 rounded-full"
                    initial={{ scaleY: 1.3, scaleX: 0.95 }}
                    animate={{ scaleY: 1, scaleX: 1 }}
                    transition={{ layout: snappy, scaleX: jelly, scaleY: jelly }}
                    style={{ borderRadius: 999 }}
                  />
                )}
                <n.icon size={18} strokeWidth={2} className="relative shrink-0" style={{ color: n.color }} />
                <span className={cn('relative hidden flex-1 text-left lg:block', active && 'font-semibold')}>{n.label}</span>
                {count ? <span className="relative hidden text-[13px] tabular-nums text-label-2 lg:block">{count}</span> : null}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />
        <FocusMini />
        <button
          onClick={() => setSettingsOpen(true)}
          className="press relative flex h-9 w-full items-center justify-center gap-2.5 rounded-full px-3 text-[14px] text-label-2 lg:justify-start"
          title="Einstellungen"
        >
          <Settings size={17} />
          <span className="hidden lg:inline">Einstellungen</span>
        </button>
      </Glass>
    </motion.div>
  )
})

/** iOS 26 tab bar: floating glass capsule with a liquid selection droplet, plus a round search button. */
export const TabBar = memo(function TabBar() {
  const view = useStore(ui, (s) => s.view)
  const focusMode = useStore(ui, (s) => s.focusMode)
  return (
    <motion.nav
      aria-label="Bereiche"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
      initial={false}
      animate={focusMode ? { y: 110, opacity: 0 } : { y: 0, opacity: 1 }}
      transition={smooth}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <Glass radius="full" variant="clear" interactive className="flex h-[62px] min-w-0 flex-1 items-center px-1">
          {NAV.map((n) => {
            const active = view === n.id
            return (
              <motion.button
                key={n.id}
                aria-label={n.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(n.id)}
                whileTap={{ scale: 1.12 }}
                transition={jelly}
                className={cn('relative grid h-[54px] min-w-0 flex-1 place-items-center rounded-full', active ? 'text-accent' : 'text-label')}
              >
                {active && <LiquidPill layoutId="tab-sel" />}
                <n.icon size={22} strokeWidth={active ? 2.3 : 1.9} className="relative" />
              </motion.button>
            )
          })}
        </Glass>
        <GlassButton label="Suchen" size={62} onClick={openCommand}>
          <Search size={22} />
        </GlassButton>
      </div>
    </motion.nav>
  )
})

/**
 * iOS 26 scroll edge: once content scrolls under the floating toolbar it
 * softly blurs out, and the compact title fades in.
 */
export function TopBar() {
  const view = useStore(ui, (s) => s.view)
  const focusMode = useStore(ui, (s) => s.focusMode)
  const ref = useContext(ScrollContext)
  const { scrollY } = useScroll({ container: ref ?? undefined })
  const edge = useTransform(scrollY, [0, 24], [0, 1])
  const title = useTransform(scrollY, [44, 70], [0, 1])
  const label = NAV.find((n) => n.id === view)?.label
  if (focusMode) return null
  return (
    <div className="pointer-events-none sticky top-0 z-20 h-0">
      <motion.div style={{ opacity: edge }} className="scroll-edge absolute inset-x-0 top-0 h-[calc(84px+env(safe-area-inset-top))]" />
      <motion.div style={{ opacity: title }} className="absolute inset-x-0 top-[max(20px,calc(env(safe-area-inset-top)+12px))] text-center text-[17px] font-semibold md:top-7">
        {label}
      </motion.div>
    </div>
  )
}
