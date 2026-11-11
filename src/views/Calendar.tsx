import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ChevronLeft, ChevronRight, GripVertical, Plus } from 'lucide-react'
import type { Project, Task } from '../types'
import { useStore } from '../lib/createStore'
import { db } from '../store'
import { openCreate, openEvent, openTask, toggleTask } from '../actions'
import { addDaysKey, fmtDate, fmtTime, isoWeek, nowMinutes, relativeDay, todayKey, WEEKDAYS_SHORT, weekDays } from '../lib/date'
import { useIsLg, useNow } from '../lib/hooks'
import { dragStore, startDrag, type DragInfo } from '../lib/dnd'
import { smooth, snappy } from '../lib/motion'
import { cn } from '../lib/utils'
import { Button, GlassButton, PageHeader, Segmented } from '../components/ui'
import { Checkbox } from '../components/Checkbox'
import { celebrate } from '../components/Effects'

const HOUR_H = 52
const START = 6
const END = 24
const GUTTER = 48

interface Item {
  id: string
  kind: 'event' | 'task'
  title: string
  date: string
  start: number
  duration: number
  color: string
  done?: boolean
}

/** Overlapping items share the width side by side. */
function layoutDay(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.duration - a.duration)
  const res = new Map<string, { lane: number; lanes: number }>()
  let cluster: Item[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const it of cluster) res.get(it.kind + it.id)!.lanes = laneEnds.length
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((e) => e <= it.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = it.start + it.duration
    res.set(it.kind + it.id, { lane, lanes: 1 })
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.start + it.duration)
  }
  flush()
  return res
}

const slide: Variants = {
  enter: (d: number) => ({ x: d * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
}

export default function CalendarView() {
  const isLg = useIsLg()
  const [mode, setMode] = useState<'day' | 'week'>(() => (matchMedia('(min-width: 768px)').matches ? 'week' : 'day'))
  const [anchor, setAnchor] = useState(todayKey())
  const [dir, setDir] = useState(0)
  const tasks = useStore(db, (s) => s.tasks)
  const events = useStore(db, (s) => s.events)
  const projects = useStore(db, (s) => s.projects)
  const drag = useStore(dragStore, (s) => s)
  useNow(60_000)

  const scrollRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = Math.max(0, (Math.min(nowMinutes() / 60, 20) - 1.5 - START) * HOUR_H)
  }, [])

  const days = mode === 'day' ? [anchor] : weekDays(anchor)
  const t = todayKey()
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>()
    const push = (i: Item) => (map.get(i.date) ?? map.set(i.date, []).get(i.date)!).push(i)
    for (const e of events) push({ id: e.id, kind: 'event', title: e.title, date: e.date, start: e.start, duration: e.duration, color: e.color })
    for (const x of tasks)
      if (x.schedule)
        push({
          id: x.id,
          kind: 'task',
          title: x.title,
          date: x.schedule.date,
          start: x.schedule.start,
          duration: x.schedule.duration,
          color: (x.projectId && byId.get(x.projectId)?.color) || '#007aff',
          done: x.status === 'done',
        })
    return map
  }, [events, tasks, byId])

  const backlog = useMemo(
    () => tasks.filter((x) => x.status !== 'done' && !x.schedule).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || b.priority - a.priority),
    [tasks],
  )

  const step = (n: number) => {
    setDir(n)
    setAnchor((a) => addDaysKey(a, n * (mode === 'day' ? 1 : 7)))
  }
  const title = fmtDate(days[0], { month: 'long', year: 'numeric' })
  const subtitle = mode === 'day' ? fmtDate(anchor, { weekday: 'long', day: 'numeric', month: 'long' }) : `Kalenderwoche ${isoWeek(anchor)}`
  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Segmented
              value={mode}
              onChange={(m) => (setDir(0), setMode(m))}
              layoutId="cal-mode"
              options={[
                { value: 'day', label: 'Tag' },
                { value: 'week', label: 'Woche' },
              ]}
            />
            <GlassButton label="Neuer Termin" onClick={() => openCreate('event', { date: anchor })}>
              <Plus size={20} strokeWidth={2.3} />
            </GlassButton>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-1">
        <GlassButton label="Zurück" size={36} onClick={() => step(-1)}>
          <ChevronLeft size={19} />
        </GlassButton>
        <GlassButton label="Weiter" size={36} onClick={() => step(1)}>
          <ChevronRight size={19} />
        </GlassButton>
        {anchor !== t && (
          <Button variant="plain" size="sm" onClick={() => (setDir(anchor < t ? 1 : -1), setAnchor(t))}>
            Heute
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-5">
        <Backlog tasks={backlog} byId={byId} drag={drag} horizontal={!isLg} />

        <div className="surface overflow-hidden rounded-[18px]">
          <div ref={scrollRef} data-autoscroll className="relative h-[calc(100dvh-290px)] min-h-[440px] overflow-y-auto overflow-x-hidden md:h-[calc(100dvh-230px)]">
            {/* the previous range is replaced at once; the new one slides in from the side you moved to */}
            <motion.div key={mode + days[0]} custom={dir} variants={slide} initial={dir ? 'enter' : false} animate="center" transition={smooth} className="relative">
                <div className="sticky top-0 z-20 grid bg-surface [box-shadow:0_0.5px_0_var(--sep)]" style={{ gridTemplateColumns: cols }}>
                  <div />
                  {days.map((d, i) => {
                    const isT = d === t
                    return (
                      <div key={d} className="flex items-center justify-center gap-1.5 py-2.5">
                        <span className={cn('text-[13px]', isT ? 'font-semibold text-ios-red' : 'text-label-2')}>{mode === 'day' ? relativeDay(d) : WEEKDAYS_SHORT[i]}</span>
                        <span className={cn('grid h-7 min-w-7 place-items-center rounded-full px-1 text-[15px] font-semibold tabular-nums', isT && 'bg-ios-red text-white')}>{Number(d.slice(8))}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="relative grid" style={{ gridTemplateColumns: cols, height: (END - START) * HOUR_H }}>
                  <div className="relative">
                    {Array.from({ length: END - START }, (_, i) =>
                      i === 0 ? null : (
                        <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-label-2" style={{ top: i * HOUR_H }}>
                          {String(START + i).padStart(2, '0')}
                        </span>
                      ),
                    )}
                  </div>
                  {days.map((d) => (
                    <DayColumn key={d} date={d} items={itemsByDay.get(d) ?? []} isToday={d === t} drag={drag} compact={days.length > 1} />
                  ))}
                </div>
              </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

const DayColumn = memo(function DayColumn({ date, items, isToday, drag, compact }: { date: string; items: Item[]; isToday: boolean; drag: DragInfo | null; compact: boolean }) {
  const visible = drag ? items.filter((i) => i.id !== drag.id) : items
  const lanes = useMemo(() => layoutDay(visible), [visible])
  const target = drag?.over?.zone === 'cal' && drag.over.date === date ? drag.over : null
  const now = nowMinutes()

  return (
    <div
      data-drop="cal"
      data-date={date}
      data-start={START}
      data-end={END}
      data-hourh={HOUR_H}
      className="relative [box-shadow:inset_0.5px_0_0_var(--sep)]"
      style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--sep) 0, var(--sep) 0.5px, transparent 0.5px, transparent ${HOUR_H}px)` }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect()
        const m = Math.floor((START * 60 + ((e.clientY - r.top) / HOUR_H) * 60) / 30) * 30
        openCreate('event', { date, start: Math.min(m, END * 60 - 60) })
      }}
    >
      {visible.map((it) => (
        <Block key={it.kind + it.id} item={it} lane={lanes.get(it.kind + it.id)!} compact={compact} />
      ))}

      {isToday && now >= START * 60 && (
        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: ((now - START * 60) / 60) * HOUR_H }}>
          <div className="relative h-[1.5px] bg-ios-red">
            <span className="absolute -left-[4px] -top-[3.5px] h-2 w-2 rounded-full bg-ios-red" />
          </div>
        </div>
      )}

      <AnimatePresence>
        {target && drag && (
          <motion.div
            data-placeholder
            className="ev pointer-events-none absolute inset-x-[3px] top-0 z-20 overflow-hidden rounded-[6px] px-2 py-1"
            style={{ height: Math.max(20, (drag.duration / 60) * HOUR_H - 2), ['--c' as string]: drag.color }}
            initial={{ opacity: 0, y: ((target.start - START * 60) / 60) * HOUR_H }}
            animate={{ opacity: 1, y: ((target.start - START * 60) / 60) * HOUR_H }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={snappy}
          >
            <span className="pl-1 text-[11px] font-semibold tabular-nums">
              {fmtTime(target.start)} – {fmtTime(target.start + drag.duration)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

const Block = memo(function Block({ item, lane, compact }: { item: Item; lane: { lane: number; lanes: number }; compact: boolean }) {
  const h = Math.max(20, (item.duration / 60) * HOUR_H - 2)
  const top = ((item.start - START * 60) / 60) * HOUR_H + 1
  const cbRef = useRef<HTMLSpanElement>(null)
  const w = 100 / lane.lanes
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: item.done ? 0.5 : 1 }}
      transition={{ duration: 0.2 }}
      onPointerDown={(e) => startDrag(e, { id: item.id, type: item.kind, title: item.title, color: item.color, duration: item.duration })}
      onClick={() => (item.kind === 'task' ? openTask(item.id) : openEvent(item.id))}
      className="ev draggable absolute z-[1] cursor-default overflow-hidden rounded-[6px] py-[3px] pl-2 pr-1"
      style={{ top, height: h, left: `calc(${lane.lane * w}% + 2px)`, width: `calc(${w}% - 4px)`, ['--c' as string]: item.color }}
    >
      <div className="flex items-start gap-1 pl-0.5">
        {item.kind === 'task' && (
          <span ref={cbRef} className="mt-[1px]">
            <Checkbox size={13} checked={!!item.done} color={item.color} onToggle={() => (!item.done && celebrate(cbRef.current, item.color), toggleTask(item.id))} />
          </span>
        )}
        <div className="min-w-0">
          <div className={cn('truncate text-[12px] font-semibold leading-[15px]', item.done && 'line-through')}>{item.title}</div>
          {h > 32 && <div className="truncate text-[11px] tabular-nums leading-[14px] opacity-80">{compact ? fmtTime(item.start) : `${fmtTime(item.start)} – ${fmtTime(item.start + item.duration)}`}</div>}
        </div>
      </div>
    </motion.div>
  )
})

function Backlog({ tasks, byId, drag, horizontal }: { tasks: Task[]; byId: Map<string, Project>; drag: DragInfo | null; horizontal: boolean }) {
  const hot = drag?.over?.zone === 'backlog' && drag.type === 'task'
  const visible = drag ? tasks.filter((t) => t.id !== drag.id) : tasks
  return (
    <div data-drop="backlog" className={cn('min-w-0', !horizontal && 'flex h-[calc(100dvh-230px)] min-h-[440px] flex-col')}>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <span className="text-[15px] font-semibold">Ungeplant</span>
        <span className="text-[15px] tabular-nums text-label-2">{visible.length}</span>
      </div>
      <motion.div
        className={cn('relative', horizontal ? 'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1' : 'list min-h-0 flex-1 overflow-y-auto')}
        animate={{ scale: hot ? 1.01 : 1 }}
        transition={snappy}
        style={hot ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}
      >
        {visible.map((t) => {
          const p = t.projectId ? byId.get(t.projectId) : undefined
          return (
            <div
              key={t.id}
              onPointerDown={(e) => startDrag(e, { id: t.id, type: 'task', title: t.title, color: p?.color ?? '#007aff', duration: 60 })}
              onClick={() => openTask(t.id)}
              className={cn('draggable press row cursor-grab gap-2.5 active:cursor-grabbing', horizontal ? 'surface min-h-[44px] max-w-[230px] shrink-0 rounded-[12px] pl-2 pr-3' : 'min-h-[48px] pl-2')}
              style={{ ['--sep-inset' as string]: '36px' }}
            >
              <GripVertical size={14} className="shrink-0 text-label-3" />
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p?.color ?? 'var(--accent)' }} />
              <span className="min-w-0 flex-1 truncate text-[15px]">{t.title}</span>
              {t.due && !horizontal && <span className="shrink-0 text-[12px] text-label-2">{relativeDay(t.due)}</span>}
            </div>
          )
        })}
        {!visible.length && <div className="row min-h-[48px] justify-center text-[15px] text-label-2">Alles eingeplant</div>}
      </motion.div>
      {!horizontal && <p className="t-sub mt-2 px-1">In den Kalender ziehen, um einen Zeitblock zu planen.</p>}
    </div>
  )
}
