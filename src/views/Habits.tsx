import { memo, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Ellipsis, Plus } from 'lucide-react'
import type { Habit } from '../types'
import { useStore } from '../lib/createStore'
import { db, ui } from '../store'
import { addHabit, deleteHabit, restoreHabit, setHabitAdd, toggleHabit } from '../actions'
import { todayKey, WEEKDAYS_SHORT, weekDays } from '../lib/date'
import { completionRate, currentStreak, longestStreak } from '../lib/habits'
import { HABIT_ICONS } from '../lib/icons'
import { smooth, snappy } from '../lib/motion'
import { toast } from '../lib/toast'
import { cn, PALETTE } from '../lib/utils'
import { GlassButton, Menu, PageHeader, RowIcon } from '../components/ui'
import { AnimatedNumber } from '../components/Numbers'
import { HabitCheck } from '../components/HabitCheck'
import { celebrate } from '../components/Effects'
import { Group, Sheet } from '../components/Sheet'

export default function HabitsView() {
  const habits = useStore(db, (s) => s.habits)
  const adding = useStore(ui, (s) => s.habitAdd)
  const t = todayKey()
  const week = weekDays(t)

  const stats = useMemo(() => {
    const done = habits.filter((h) => h.log[t]).length
    const best = Math.max(0, ...habits.map((h) => currentStreak(h.log, t)))
    const rate = habits.length ? habits.reduce((a, h) => a + completionRate(h.log, t), 0) / habits.length : 0
    return { done, best, rate }
  }, [habits, t])

  return (
    <div>
      <PageHeader
        title="Gewohnheiten"
        subtitle={`${stats.done} von ${habits.length} heute erledigt`}
        actions={
          <GlassButton label="Neue Gewohnheit" onClick={() => setHabitAdd(true)}>
            <Plus size={20} strokeWidth={2.3} />
          </GlassButton>
        }
      />

      <div className="surface mb-8 grid grid-cols-3 rounded-[16px] py-3">
        <Stat label="Heute" value={<><AnimatedNumber value={stats.done} /><span className="text-label-2">/{habits.length}</span></>} />
        <Stat label="Beste Serie" value={<><AnimatedNumber value={stats.best} /> <span className="text-[15px] font-semibold text-label-2">Tage</span></>} border />
        <Stat label="Letzte 30 Tage" value={<><AnimatedNumber value={Math.round(stats.rate * 100)} />%</>} border />
      </div>

      <div className="mb-2 hidden items-end px-4 md:flex">
        <span className="flex-1" />
        <div className="mr-[54px] flex gap-1">
          {week.map((d, i) => (
            <span key={d} className={cn('w-8 text-center text-[11px] font-medium', d === t ? 'text-accent' : 'text-label-2')}>
              {WEEKDAYS_SHORT[i]}
            </span>
          ))}
        </div>
      </div>

      <ul className="list">
        <AnimatePresence initial={false}>
          {habits.map((h) => (
            <motion.li key={h.id} layout="position" exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={smooth}>
              <HabitRow habit={h} week={week} today={t} />
            </motion.li>
          ))}
        </AnimatePresence>
        {!habits.length && <li className="row min-h-[56px] justify-center text-label-2">Noch keine Gewohnheiten</li>}
      </ul>

      <AnimatePresence>{adding && <AddHabit key="add" />}</AnimatePresence>
    </div>
  )
}

function Stat({ label, value, border }: { label: string; value: ReactNode; border?: boolean }) {
  return (
    <div className={cn('px-4 text-center', border && '[box-shadow:inset_0.5px_0_0_var(--sep)]')}>
      <div className="text-[13px] text-label-2">{label}</div>
      <div className="mt-0.5 text-[24px] font-bold tabular-nums tracking-tight">{value}</div>
    </div>
  )
}

const HabitRow = memo(function HabitRow({ habit, week, today }: { habit: Habit; week: string[]; today: string }) {
  const done = !!habit.log[today]
  const streak = currentStreak(habit.log, today)
  const best = longestStreak(habit.log)
  const Icon = HABIT_ICONS[habit.icon] ?? Check
  const ref = useRef<HTMLButtonElement>(null)

  const remove = () => {
    const h = deleteHabit(habit.id)
    if (h) toast(`«${h.name}» gelöscht`, 'trash', { label: 'Widerrufen', run: () => restoreHabit(h) })
  }

  return (
    <div className="row min-h-[64px] flex-wrap gap-y-2 py-2.5 md:flex-nowrap" style={{ ['--sep-inset' as string]: '57px' }}>
      <RowIcon color={habit.color}>
        <Icon size={16} />
      </RowIcon>
      <div className="min-w-0 flex-1">
        <div className="t-body truncate">{habit.name}</div>
        <div className="t-sub">
          {streak ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge` : 'Keine aktuelle Serie'}
          {best > streak && ` · Rekord ${best}`}
        </div>
      </div>

      {/* this week – earlier days can be corrected */}
      <div className="order-last flex w-full gap-1 pl-[41px] md:order-none md:w-auto md:pl-0">
        {week.map((d, i) => {
          const on = !!habit.log[d]
          const future = d > today
          return (
            <motion.button
              key={d}
              disabled={future}
              whileTap={{ scale: 0.85 }}
              transition={snappy}
              onClick={() => toggleHabit(habit.id, d)}
              aria-label={`${WEEKDAYS_SHORT[i]}: ${on ? 'erledigt' : 'offen'}`}
              className="flex w-8 flex-col items-center gap-0.5 disabled:opacity-30"
            >
              <span className={cn('text-[10px] md:hidden', d === today ? 'font-semibold text-accent' : 'text-label-2')}>{WEEKDAYS_SHORT[i]}</span>
              <span className="relative h-[22px] w-[22px] rounded-full bg-fill">
                <motion.span className="absolute inset-0 rounded-full" style={{ background: habit.color }} initial={false} animate={{ scale: on ? 1 : 0.3, opacity: on ? 1 : 0 }} transition={snappy} />
              </span>
            </motion.button>
          )
        })}
      </div>

      <HabitCheck ref={ref} done={done} color={habit.color} label={habit.name} size={32} onToggle={() => (!done && celebrate(ref.current, habit.color), toggleHabit(habit.id))} />
      <Menu label="Optionen" showCheck={false} onSelect={remove} items={[{ value: 'delete', label: 'Löschen', destructive: true }]} className="grid h-8 w-8 place-items-center rounded-full text-label-2">
        <Ellipsis size={18} />
      </Menu>
    </div>
  )
})

function AddHabit() {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('sparkles')
  const [color, setColor] = useState(PALETTE[0])
  const submit = () => {
    if (!name.trim()) return
    addHabit({ name: name.trim(), icon, color })
    setHabitAdd(false)
  }
  return (
    <Sheet title="Neue Gewohnheit" onClose={() => setHabitAdd(false)} onConfirm={submit} confirmDisabled={!name.trim()}>
      <Group>
        <div className="row">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="z. B. 10 Minuten spazieren"
            className="h-[50px] w-full bg-transparent text-[17px] outline-none placeholder:text-label-3 md:text-[15px]"
          />
        </div>
      </Group>
      <Group>
        <div className="flex justify-between p-4">
          {PALETTE.map((c) => (
            <motion.button key={c} whileTap={{ scale: 0.88 }} transition={snappy} aria-label={`Farbe ${c}`} onClick={() => setColor(c)} className="relative h-8 w-8 rounded-full" style={{ background: c }}>
              {color === c && <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute -inset-[4px] rounded-full" style={{ boxShadow: `0 0 0 2.5px ${c}` }} transition={snappy} />}
            </motion.button>
          ))}
        </div>
      </Group>
      <Group>
        <div className="grid grid-cols-6 gap-3 p-4">
          {Object.entries(HABIT_ICONS).map(([k, I]) => (
            <motion.button
              key={k}
              whileTap={{ scale: 0.88 }}
              transition={snappy}
              aria-label={k}
              onClick={() => setIcon(k)}
              className="grid aspect-square place-items-center rounded-full"
              style={icon === k ? { background: color, color: 'white' } : { background: 'var(--fill)' }}
            >
              <I size={18} />
            </motion.button>
          ))}
        </div>
      </Group>
    </Sheet>
  )
}
