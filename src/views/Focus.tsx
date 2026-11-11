import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useSpring } from 'framer-motion'
import { Bell, Minimize2, Target } from 'lucide-react'
import type { FocusSettings } from '../types'
import { useStore } from '../lib/createStore'
import { db, ui } from '../store'
import { setFocusMode, setFocusSetting } from '../actions'
import { addDaysKey, fmtClock, fmtTime, todayKey, WEEKDAYS_SHORT, weekdayIndex } from '../lib/date'
import { useIsLg, useIsMd } from '../lib/hooks'
import { smooth, snappy } from '../lib/motion'
import { PHASE_LABEL, pauseTimer, phaseTotal, remainingMs, resetTimer, setFocusTask, setPhase, skipPhase, startTimer, timer, type Phase } from '../lib/timer'
import { cn } from '../lib/utils'
import { Button, GlassButton, Menu, MenuValue, PageHeader, Segmented, Stepper } from '../components/ui'

const COLOR: Record<Phase, string> = { work: 'var(--orange)', short: 'var(--green)', long: 'var(--teal)' }

export default function FocusView() {
  const s = useStore(timer, (x) => x)
  const focusMode = useStore(ui, (u) => u.focusMode)
  const settings = useStore(db, (d) => d.settings.focus)
  const log = useStore(db, (d) => d.focusLog)
  const isMd = useIsMd()
  const isLg = useIsLg()

  // Starting a session hides the rest of the app; leaving the view brings it back.
  const wasRunning = useRef(false)
  useEffect(() => {
    if (s.running && !wasRunning.current) setFocusMode(true)
    if (!s.running && wasRunning.current && remainingMs() <= 0) setFocusMode(false)
    wasRunning.current = s.running
  }, [s.running])
  useEffect(
    () => () => {
      setFocusMode(false)
      wasRunning.current = false
    },
    [],
  )

  const shift = focusMode ? (isLg ? -130 : isMd ? -46 : 0) : 0
  const today = log[todayKey()]
  const idle = !s.running && s.remaining >= phaseTotal(s.phase)
  const hide = { opacity: focusMode ? 0 : 1 }

  return (
    <div>
      <motion.div initial={false} animate={hide} transition={{ duration: 0.3 }} style={{ pointerEvents: focusMode ? 'none' : 'auto' }}>
        <PageHeader title="Fokus" subtitle={today ? `Heute ${today.sessions} ${today.sessions === 1 ? 'Session' : 'Sessions'} · ${today.minutes} Min.` : 'Heute noch keine Session'} />
      </motion.div>

      <motion.div className="flex flex-col items-center" initial={false} animate={{ x: shift, y: focusMode ? 30 : 0 }} transition={smooth}>
        <motion.div initial={false} animate={hide} style={{ pointerEvents: focusMode ? 'none' : 'auto' }}>
          <Segmented
            value={s.phase}
            onChange={setPhase}
            layoutId="focus-phase"
            options={[
              { value: 'work', label: 'Fokus' },
              { value: 'short', label: 'Kurze Pause' },
              { value: 'long', label: 'Lange Pause' },
            ]}
          />
        </motion.div>

        <TaskPicker taskId={s.taskId ?? null} locked={focusMode} />
        <Ring phase={s.phase} running={s.running} cycle={s.cycle} />

        <div className="flex w-[min(86vw,360px)] items-center justify-between">
          <ClockButton label={idle ? 'Abbrechen' : 'Zurücksetzen'} color="var(--label-2)" disabled={idle} onClick={resetTimer} />
          <ClockButton
            label={s.running ? 'Pause' : idle ? 'Start' : 'Fortsetzen'}
            color={s.running ? 'var(--orange)' : 'var(--green)'}
            onClick={() => (s.running ? pauseTimer() : startTimer())}
          />
        </div>
        <motion.div initial={false} animate={hide} className="mt-4">
          <Button variant="plain" size="sm" onClick={skipPhase}>
            {s.phase === 'work' ? 'Pause beginnen' : 'Pause überspringen'}
          </Button>
        </motion.div>
      </motion.div>

      <motion.div className="mx-auto mt-10 grid max-w-[720px] gap-6 md:grid-cols-2" initial={false} animate={hide} style={{ pointerEvents: focusMode ? 'none' : 'auto' }}>
        <Durations settings={settings} />
        <Week log={log} />
      </motion.div>

      {createPortal(
        <AnimatePresence>
          {focusMode && (
            <motion.div className="fixed right-4 top-[max(16px,env(safe-area-inset-top))] z-40" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={snappy}>
              <GlassButton label="Fokus-Modus verlassen (Esc)" size={44} onClick={() => setFocusMode(false)}>
                <Minimize2 size={18} />
              </GlassButton>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** Apple Clock style round button with the double ring. */
function ClockButton({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95, opacity: 0.8 }}
      transition={snappy}
      onClick={onClick}
      disabled={disabled}
      className="relative grid h-[84px] w-[84px] place-items-center rounded-full text-[15px] font-medium disabled:opacity-40"
      style={{ color: `color-mix(in srgb, ${color} 82%, var(--label))`, background: `color-mix(in srgb, ${color} 22%, transparent)` }}
    >
      <span className="pointer-events-none absolute inset-[3px] rounded-full" style={{ boxShadow: `0 0 0 2px var(--bg)` }} />
      {label}
    </motion.button>
  )
}

/**
 * Driven by requestAnimationFrame (framer's useAnimationFrame): follows the
 * display's real refresh rate. Only motion values and one text node change per frame.
 */
function Ring({ phase, running, cycle }: { phase: Phase; running: boolean; cycle: number }) {
  const progress = useMotionValue(remainingMs() / phaseTotal(timer.get().phase))
  const smoothP = useSpring(progress, { stiffness: 120, damping: 26 })
  const timeRef = useRef<HTMLSpanElement>(null)
  const endRef = useRef<HTMLSpanElement>(null)

  useAnimationFrame(() => {
    const st = timer.get()
    const ms = remainingMs(st)
    progress.set(Math.min(1, ms / phaseTotal(st.phase)))
    const txt = fmtClock(ms)
    if (timeRef.current && timeRef.current.textContent !== txt) timeRef.current.textContent = txt
    const end = new Date(Date.now() + ms)
    const endTxt = fmtTime(end.getHours() * 60 + end.getMinutes())
    if (endRef.current && endRef.current.textContent !== endTxt) endRef.current.textContent = endTxt
  })

  const S = 320
  const W = 8
  const r = S / 2 - W

  return (
    <div className="relative my-8 aspect-square w-[min(80vw,320px)]">
      <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx={S / 2} cy={S / 2} r={r} fill="none" strokeWidth={W} stroke="var(--fill)" />
        <motion.circle cx={S / 2} cy={S / 2} r={r} fill="none" strokeWidth={W} strokeLinecap="round" stroke={COLOR[phase]} style={{ pathLength: smoothP }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-medium text-label-2">{PHASE_LABEL[phase]}</span>
        <span ref={timeRef} className="text-[68px] font-light leading-[1.1] tracking-[-0.03em] tabular-nums md:text-[76px]">
          {fmtClock(remainingMs())}
        </span>
        <span className={cn('flex items-center gap-1 text-[15px] text-label-2 transition-opacity', running ? 'opacity-100' : 'opacity-0')}>
          <Bell size={14} fill="currentColor" /> <span ref={endRef} className="tabular-nums" />
        </span>
        <div className="mt-3 flex gap-1.5" aria-label={`${cycle % 4} von 4 Sessions`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < cycle % 4 ? 'var(--orange)' : 'var(--fill-3)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Durations({ settings }: { settings: FocusSettings }) {
  const rows: { key: keyof FocusSettings; label: string; min: number; max: number; step: number }[] = [
    { key: 'work', label: 'Fokus', min: 5, max: 90, step: 5 },
    { key: 'short', label: 'Kurze Pause', min: 1, max: 30, step: 1 },
    { key: 'long', label: 'Lange Pause', min: 5, max: 60, step: 5 },
  ]
  return (
    <section>
      <h2 className="mb-2 px-1 text-[15px] font-semibold">Dauer</h2>
      <div className="list">
        {rows.map((r) => (
          <div key={r.key} className="row min-h-[52px]">
            <span className="t-body flex-1">{r.label}</span>
            <span className="t-body w-16 text-right tabular-nums text-label-2">{settings[r.key]} Min.</span>
            <Stepper onDec={() => setFocusSetting(r.key, Math.max(r.min, settings[r.key] - r.step))} onInc={() => setFocusSetting(r.key, Math.min(r.max, settings[r.key] + r.step))} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Week({ log }: { log: Record<string, { sessions: number; minutes: number }> }) {
  const t = todayKey()
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(t, i - 6)), [t])
  const max = Math.max(50, ...days.map((d) => log[d]?.minutes ?? 0))
  const total = days.reduce((a, d) => a + (log[d]?.minutes ?? 0), 0)
  return (
    <section>
      <h2 className="mb-2 flex justify-between px-1 text-[15px] font-semibold">
        Letzte 7 Tage <span className="font-normal tabular-nums text-label-2">{(total / 60).toFixed(1)} Std.</span>
      </h2>
      <div className="surface flex h-[156px] items-end gap-2.5 rounded-[14px] px-4 pb-3 pt-4">
        {days.map((d) => {
          const v = (log[d]?.minutes ?? 0) / max
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="relative h-[100px] w-full max-w-[22px]">
                {/* scaleY keeps the bar animation transform-only */}
                <motion.div
                  className="absolute inset-0 origin-bottom rounded-[5px]"
                  style={{ background: d === t ? 'var(--orange)' : 'color-mix(in srgb, var(--orange) 35%, transparent)' }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: Math.max(0.03, v) }}
                  transition={smooth}
                />
              </div>
              <span className={cn('text-[11px]', d === t ? 'font-semibold' : 'text-label-2')}>{WEEKDAYS_SHORT[weekdayIndex(d)]}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * "Woran arbeitest du?" – a session belongs to a task. Its focus time is
 * recorded on the task and at the end Flow asks whether it is done.
 */
function TaskPicker({ taskId, locked }: { taskId: string | null; locked: boolean }) {
  const tasks = useStore(db, (d) => d.tasks)
  const t = todayKey()
  const options = useMemo(
    () =>
      tasks
        .filter((x) => x.status !== 'done')
        .sort((a, b) => Number(!!b.due && b.due <= t) - Number(!!a.due && a.due <= t) || b.priority - a.priority || a.order - b.order)
        .slice(0, 12),
    [tasks, t],
  )
  const current = tasks.find((x) => x.id === taskId)
  const label = current ? current.title : 'Ohne Aufgabe'
  if (locked)
    return current ? (
      <p className="mt-5 flex max-w-[80vw] items-center gap-1.5 truncate text-[17px] font-medium text-label-2">
        <Target size={16} className="shrink-0 text-ios-orange" /> {current.title}
      </p>
    ) : (
      <div className="mt-5 h-[25px]" />
    )
  return (
    <div className="mt-5 flex max-w-[86vw] items-center gap-2">
      <span className="text-[15px] text-label-2">Woran arbeitest du?</span>
      <Menu
        label="Aufgabe für diese Session"
        value={taskId}
        onSelect={setFocusTask}
        items={[{ value: null as string | null, label: 'Ohne Aufgabe' }, ...options.map((o) => ({ value: o.id as string | null, label: o.title }))]}
        className="min-w-0"
      >
        <MenuValue>
          <span className={cn('max-w-[46vw] truncate font-medium md:max-w-[280px]', current ? 'text-label' : 'text-accent')}>{label}</span>
        </MenuValue>
      </Menu>
    </div>
  )
}
