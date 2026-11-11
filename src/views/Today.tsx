import { memo, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, CircleCheck, Flame, Plus, Settings, Timer, type LucideIcon } from 'lucide-react'
import type { Habit, ViewId } from '../types'
import { useStore } from '../lib/createStore'
import { db } from '../store'
import { navigate, openCreate, setHabitAdd, setSettingsOpen, toggleHabit } from '../actions'
import { diffDays, fmtDate, todayKey } from '../lib/date'
import { useNow } from '../lib/hooks'
import { currentStreak } from '../lib/habits'
import { HABIT_ICONS } from '../lib/icons'
import { smooth, snappy } from '../lib/motion'
import { GlassButton, PageHeader, RowIcon, SectionHeader } from '../components/ui'
import { AnimatedNumber, ProgressRing } from '../components/Numbers'
import { TaskRow } from '../components/TaskRow'
import { celebrate } from '../components/Effects'
import { HabitCheck } from '../components/HabitCheck'
import { DayPlan } from '../components/DayPlan'

export default function TodayView() {
  const tasks = useStore(db, (s) => s.tasks)
  const projects = useStore(db, (s) => s.projects)
  const events = useStore(db, (s) => s.events)
  const habits = useStore(db, (s) => s.habits)
  const focus = useStore(db, (s) => s.focusLog[todayKey()])
  useNow(60_000)
  const t = todayKey()
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const { open, doneToday } = useMemo(() => {
    const open = tasks
      .filter((x) => x.status !== 'done' && ((x.due && diffDays(x.due, t) <= 0) || x.schedule?.date === t))
      .sort((a, b) => (a.schedule?.start ?? 9999) - (b.schedule?.start ?? 9999) || b.priority - a.priority || a.order - b.order)
    const today = new Date().toDateString()
    const doneToday = tasks.filter((x) => x.status === 'done' && x.completedAt && new Date(x.completedAt).toDateString() === today).length
    return { open, doneToday }
  }, [tasks, t])

  const total = open.length + doneToday
  const habitsDone = habits.filter((h) => h.log[t]).length
  const eventsToday = events.filter((e) => e.date === t).length

  return (
    <div>
      <PageHeader
        title="Heute"
        subtitle={fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <>
            <GlassButton label="Einstellungen" onClick={() => setSettingsOpen(true)} className="md:hidden">
              <Settings size={19} />
            </GlassButton>
            <GlassButton label="Neue Aufgabe" onClick={() => openCreate('task', { due: t })}>
              <Plus size={20} strokeWidth={2.3} />
            </GlassButton>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={CalendarDays} color="var(--accent)" label="Offen" value={open.length} to="tasks" />
        <Tile icon={CircleCheck} color="var(--red)" label="Termine" value={eventsToday} to="calendar" />
        <Tile icon={Flame} color="var(--green)" label="Gewohnheiten" value={habitsDone} suffix={`/${habits.length}`} to="habits" />
        <Tile icon={Timer} color="var(--indigo)" label="Fokus-Min." value={focus?.minutes ?? 0} to="focus" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
        <section>
          <SectionHeader
            action={
              total > 0 && (
                <span className="flex items-center gap-2 text-[13px] text-label-2">
                  <ProgressRing value={doneToday / total} size={20} stroke={3} colors={['var(--accent)']} />
                  <span className="tabular-nums">
                    {doneToday} von {total}
                  </span>
                </span>
              )
            }
          >
            Aufgaben
          </SectionHeader>
          <ul className="list">
            <AnimatePresence initial={false} mode="popLayout">
              {open.map((task) => (
                <motion.li key={task.id} layout exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={smooth}>
                  <TaskRow task={task} project={task.projectId ? byId.get(task.projectId) : undefined} />
                </motion.li>
              ))}
              {open.length === 0 && (
                <motion.li key="empty" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="row min-h-[56px] gap-3 text-label-2">
                  <Check size={18} className="text-ios-green" /> Alles erledigt für heute.
                </motion.li>
              )}
              <motion.li key="add" layout transition={smooth}>
                <button onClick={() => openCreate('task', { due: t })} className="row press w-full text-[17px] text-accent md:text-[15px]" style={{ ['--sep-inset' as string]: '50px' }}>
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-accent text-white">
                    <Plus size={15} strokeWidth={3} />
                  </span>
                  Neue Aufgabe
                </button>
              </motion.li>
            </AnimatePresence>
          </ul>
        </section>

        <div className="space-y-8">
          <DayPlan />

          <section>
            <SectionHeader>Gewohnheiten</SectionHeader>
            <ul className="list">
              {habits.map((h) => (
                <HabitRow key={h.id} habit={h} />
              ))}
              {!habits.length && (
                <li>
                  <button onClick={() => (navigate('habits'), setHabitAdd(true))} className="row press w-full min-h-[52px] text-[15px] text-accent">
                    Erste Gewohnheit anlegen
                  </button>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Tile({ icon: Icon, color, label, value, suffix, to }: { icon: LucideIcon; color: string; label: string; value: number; suffix?: string; to: ViewId }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} transition={snappy} onClick={() => navigate(to)} className="surface press relative rounded-[16px] p-3 text-left">
      <div className="flex items-start justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: color }}>
          <Icon size={17} strokeWidth={2.3} />
        </span>
        <span className="text-[26px] font-bold leading-8 tabular-nums tracking-tight">
          <AnimatedNumber value={value} />
          {suffix && <span className="text-[17px] font-semibold text-label-2">{suffix}</span>}
        </span>
      </div>
      <div className="mt-2 text-[15px] font-semibold text-label-2">{label}</div>
    </motion.button>
  )
}

const HabitRow = memo(function HabitRow({ habit }: { habit: Habit }) {
  const t = todayKey()
  const done = !!habit.log[t]
  const streak = currentStreak(habit.log, t)
  const Icon = HABIT_ICONS[habit.icon] ?? Flame
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <li className="row min-h-[52px]" style={{ ['--sep-inset' as string]: '57px' }}>
      <RowIcon color={habit.color}>
        <Icon size={16} />
      </RowIcon>
      <div className="min-w-0 flex-1">
        <div className="t-body truncate">{habit.name}</div>
        <div className="t-sub">{streak ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge` : 'Noch keine Serie'}</div>
      </div>
      <HabitCheck ref={ref} done={done} color={habit.color} label={habit.name} onToggle={() => (!done && celebrate(ref.current, habit.color), toggleHabit(habit.id))} />
    </li>
  )
})

