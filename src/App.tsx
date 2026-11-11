import { useEffect, useRef, useState } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import type { ViewId } from './types'
import { useStore } from './lib/createStore'
import { ui } from './store'
import { closeCommand, createInContext, navigate, openCommand, setFocusMode } from './actions'
import { ScrollContext } from './lib/hooks'
import { ToolbarSlot } from './components/ui'
import { smooth, snappy } from './lib/motion'
import { finishIfDue, PHASE_LABEL, remainingMs, timer } from './lib/timer'
import { fmtClock } from './lib/date'
import { Background, ConfettiLayer, DragLayer, FocusDim, ToastLayer } from './components/Effects'
import { NAV, Sidebar, TabBar, TopBar } from './components/Navigation'
import { CommandBar } from './components/CommandBar'
import { CreateSheets, EventEditor, TaskEditor } from './components/Editors'
import { SettingsSheet, WelcomeSheet } from './components/Settings'
import TodayView from './views/Today'
import TasksView from './views/Tasks'
import CalendarView from './views/Calendar'
import NotesView from './views/Notes'
import FocusView from './views/Focus'
import HabitsView from './views/Habits'

const VIEWS: Record<ViewId, () => JSX.Element> = {
  today: TodayView,
  tasks: TasksView,
  calendar: CalendarView,
  notes: NotesView,
  focus: FocusView,
  habits: HabitsView,
}

function useGlobalShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const s = ui.get()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        s.commandOpen ? closeCommand() : openCommand()
        return
      }
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (s.commandOpen || s.create.open || s.editTask || s.editEvent || s.habitAdd || s.settingsOpen || s.welcome) return
      if (e.key === 'Escape' && s.focusMode) setFocusMode(false)
      else if (e.key === 'n') {
        e.preventDefault()
        createInContext()
      } else if (/^[1-6]$/.test(e.key)) navigate(NAV[Number(e.key) - 1].id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
}

/** Completes pomodoro phases even when the focus view is not mounted. */
function TimerEngine() {
  const running = useStore(timer, (s) => s.running)
  useEffect(() => {
    if (!running) {
      document.title = 'Flow'
      return
    }
    const done = window.setTimeout(finishIfDue, remainingMs() + 30)
    const title = window.setInterval(() => {
      // also a safety net: a long single timeout can fire late in background tabs
      finishIfDue()
      if (!timer.get().running) return
      document.title = `${fmtClock(remainingMs())} · ${PHASE_LABEL[timer.get().phase]}`
    }, 500)
    const vis = () => finishIfDue()
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.clearTimeout(done)
      window.clearInterval(title)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [running])
  return null
}

export default function App() {
  const view = useStore(ui, (s) => s.view)
  const scrollRef = useRef<HTMLElement>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const switched = useRef(false) // no fade on the very first paint
  useEffect(() => {
    if (switched.current) scrollRef.current?.scrollTo({ top: 0 })
    switched.current = true
  }, [view])
  useGlobalShortcuts()
  const View = VIEWS[view]

  return (
    <MotionConfig reducedMotion="user" transition={snappy}>
      <ScrollContext.Provider value={scrollRef}>
      <ToolbarSlot.Provider value={slot}>
        <Background />
        <FocusDim />
        <Sidebar />
        <main ref={scrollRef} data-autoscroll className="relative z-10 h-full overflow-y-auto overflow-x-hidden md:pl-[92px] lg:pl-[260px]">
          <TopBar />
          <div className="mx-auto max-w-[1120px] px-4 pb-32 pt-[max(12px,env(safe-area-inset-top))] md:px-8 md:pb-12 md:pt-10">
            {/*
              Like a native app, the old view is replaced at once and the new one fades in.
              (No exit animation: waiting for one could leave the switch stuck.)
            */}
            <motion.div
              key={view}
              initial={switched.current ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0, transition: { ...smooth, opacity: { duration: 0.2 } } }}
            >
              <View />
            </motion.div>
          </div>
        </main>
        {/* floating glass toolbar – views portal their actions in here */}
        <div ref={setSlot} className="fixed right-4 top-[max(10px,env(safe-area-inset-top))] z-40 flex items-center gap-2 md:right-6 md:top-[42px]" />
        <TabBar />
        <CommandBar />
        <CreateSheets />
        <TaskEditor />
        <EventEditor />
        <SettingsSheet />
        <WelcomeSheet />
        <ConfettiLayer />
        <DragLayer />
        <ToastLayer />
        <TimerEngine />
      </ToolbarSlot.Provider>
      </ScrollContext.Provider>
    </MotionConfig>
  )
}
