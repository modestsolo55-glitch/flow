import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Clock, Hourglass, List, Loader, Repeat2, Target } from 'lucide-react'
import type { CalEvent, Priority, Repeat, Status, Task } from '../types'
import { useStore } from '../lib/createStore'
import { db, ui, type UIState } from '../store'
import {
  addEvent,
  addTask,
  closeCreate,
  closeEvent,
  closeTask,
  deleteEvent,
  deleteTask,
  navigate,
  openTask,
  restoreEvent,
  restoreTask,
  updateEvent,
  updateTask,
} from '../actions'
import { fmtTime, REPEAT_LABEL, relativeDay, todayKey } from '../lib/date'
import { focusOn } from '../lib/timer'
import { parseQuick } from '../lib/parse'
import { toast } from '../lib/toast'
import { PRIORITY_LABELS } from '../lib/utils'
import { Group, Sheet } from './Sheet'
import { DateField, Menu, MenuValue, RowIcon, Switch, TimeField } from './ui'

/* ───────── shared rows ───────── */

function Row({ icon, label, detail, children }: { icon?: ReactNode; label: string; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="row min-h-[50px]" style={icon ? { ['--sep-inset' as string]: '57px' } : undefined}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-[22px] md:text-[15px]">{label}</div>
        {detail && <div className="truncate text-[13px] leading-4 text-accent">{detail}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function DangerRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Group>
      <button onClick={onClick} className="row press w-full justify-center text-[17px] text-ios-red md:text-[15px]">
        {label}
      </button>
    </Group>
  )
}

const DURATIONS = [15, 30, 45, 60, 90, 120]
const fmtDur = (d: number) => (d < 60 ? `${d} Min.` : d % 60 ? `${Math.floor(d / 60)} Std. ${d % 60} Min.` : `${d / 60} Std.`)

/* ───────── Task ───────── */

interface TaskDraft {
  title: string
  notes: string
  due: string | null
  time: number | null
  duration: number
  priority: Priority
  projectId: string | null
  status: Status
  repeat: Repeat | null
}

const draftFrom = (t: Task): TaskDraft => ({
  title: t.title,
  notes: t.notes,
  due: t.schedule?.date ?? t.due,
  time: t.schedule?.start ?? null,
  duration: t.schedule?.duration ?? 60,
  priority: t.priority,
  projectId: t.projectId,
  status: t.status,
  repeat: t.repeat ?? null,
})

function TaskSheet({ task, preset }: { task?: Task; preset?: UIState['create']['preset'] }) {
  const projects = useStore(db, (s) => s.projects)
  const isNew = !task
  const [d, setD] = useState<TaskDraft>(() =>
    task
      ? draftFrom(task)
      : { title: '', notes: '', due: preset?.due ?? null, time: null, duration: 60, priority: 0, projectId: preset?.projectId ?? null, status: 'todo', repeat: null },
  )
  // Natural language ("morgen 14:00 !1 #arbeit") fills the fields of a new task until you set them yourself.
  const [touched, setTouched] = useState<Set<keyof TaskDraft>>(new Set())
  const parsed = useMemo(() => (isNew ? parseQuick(d.title, projects) : null), [isNew, d.title, projects])
  const pick = <K extends keyof TaskDraft>(k: K, fromParse: TaskDraft[K] | null | undefined): TaskDraft[K] =>
    !touched.has(k) && fromParse !== null && fromParse !== undefined && fromParse !== 0 ? fromParse : d[k]
  const v: TaskDraft = parsed
    ? { ...d, due: pick('due', parsed.due), time: pick('time', parsed.time), priority: pick('priority', parsed.priority), projectId: pick('projectId', parsed.projectId) }
    : d
  const set = <K extends keyof TaskDraft>(k: K, val: TaskDraft[K]) => {
    setTouched((t) => new Set(t).add(k))
    setD((x) => ({ ...x, [k]: val }))
  }

  const title = (parsed ? parsed.title : v.title).trim()
  const project = projects.find((p) => p.id === v.projectId)
  const close = isNew ? closeCreate : closeTask

  const save = () => {
    if (!title) return
    const due = v.time !== null ? v.due ?? todayKey() : v.due
    const fields: Partial<Task> = {
      title,
      notes: v.notes,
      due,
      priority: v.priority,
      projectId: v.projectId,
      status: v.status,
      repeat: v.repeat,
      schedule: v.time !== null && due ? { date: due, start: v.time, duration: v.duration } : null,
    }
    if (isNew) {
      const id = addTask({ ...fields, title })
      toast('Aufgabe hinzugefügt', 'check', { label: 'Anzeigen', run: () => openTask(id) })
    } else updateTask(task.id, fields)
    close()
  }

  const remove = () => {
    if (!task) return
    const t = deleteTask(task.id)
    closeTask()
    if (t) toast('Aufgabe gelöscht', 'trash', { label: 'Widerrufen', run: () => restoreTask(t) })
  }

  return (
    <Sheet title={isNew ? 'Neue Aufgabe' : 'Details'} onClose={close} onConfirm={save} confirmDisabled={!title}>
      <Group>
        <div className="row">
          <input
            autoFocus={isNew}
            value={d.title}
            onChange={(e) => setD((x) => ({ ...x, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Titel"
            className="h-[50px] w-full bg-transparent text-[17px] outline-none placeholder:text-label-3 md:text-[15px]"
          />
        </div>
        <div className="row">
          <textarea
            value={d.notes}
            onChange={(e) => setD((x) => ({ ...x, notes: e.target.value }))}
            placeholder="Notizen"
            rows={2}
            className="w-full resize-none bg-transparent py-3 text-[17px] leading-snug outline-none placeholder:text-label-3 md:text-[15px]"
          />
        </div>
      </Group>
      {isNew && d.title && parsed && title !== d.title.trim() && <p className="t-sub -mt-4 mb-6 px-4">Wird gespeichert als «{title}»</p>}

      <Group>
        <Row icon={<RowIcon color="var(--red)"><CalendarDays size={17} /></RowIcon>} label="Datum" detail={v.due ? relativeDay(v.due) : undefined}>
          {v.due && <DateField value={v.due} onChange={(x) => set('due', x)} />}
          <Switch label="Datum" checked={v.due !== null} onChange={(on) => (set('due', on ? todayKey() : null), !on && set('time', null))} />
        </Row>
        <Row icon={<RowIcon color="var(--accent)"><Clock size={17} /></RowIcon>} label="Uhrzeit" detail={v.time !== null ? 'Im Kalender eingeplant' : undefined}>
          {v.time !== null && <TimeField value={v.time} onChange={(x) => set('time', x)} />}
          <Switch
            label="Uhrzeit"
            checked={v.time !== null}
            onChange={(on) => {
              if (on && !v.due) set('due', todayKey())
              set('time', on ? Math.min(23 * 60, (new Date().getHours() + 1) * 60) : null)
            }}
          />
        </Row>
        <AnimatePresence initial={false}>
          {v.time !== null && (
            <motion.div key="dur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="row sep min-h-[50px]" style={{ ['--sep-inset' as string]: '57px' }}>
              <RowIcon color="var(--teal)"><Hourglass size={16} /></RowIcon>
              <span className="flex-1 text-[17px] md:text-[15px]">Dauer</span>
              <Menu label="Dauer" value={v.duration} onSelect={(x) => set('duration', x)} items={DURATIONS.map((x) => ({ value: x, label: fmtDur(x) }))}>
                <MenuValue>{fmtDur(v.duration)}</MenuValue>
              </Menu>
            </motion.div>
          )}
        </AnimatePresence>
        <Row icon={<RowIcon color="var(--purple)"><Repeat2 size={16} /></RowIcon>} label="Wiederholen">
          <Menu
            label="Wiederholen"
            value={v.repeat}
            onSelect={(r) => {
              if (r && !v.due) set('due', todayKey())
              set('repeat', r)
            }}
            items={[{ value: null as Repeat | null, label: 'Nie' }, ...(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => ({ value: r as Repeat | null, label: REPEAT_LABEL[r] }))]}
          >
            <MenuValue>{v.repeat ? REPEAT_LABEL[v.repeat] : 'Nie'}</MenuValue>
          </Menu>
        </Row>
      </Group>

      <Group>
        <Row icon={<RowIcon color="var(--orange)"><span className="text-[17px] font-bold leading-none">!</span></RowIcon>} label="Priorität">
          <Menu label="Priorität" value={v.priority} onSelect={(x) => set('priority', x)} items={([0, 1, 2, 3] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p], icon: p ? <span className="font-semibold text-accent">{'!'.repeat(p)}</span> : undefined }))}>
            <MenuValue>{PRIORITY_LABELS[v.priority]}</MenuValue>
          </Menu>
        </Row>
        <Row icon={<RowIcon color={project?.color ?? 'var(--label-3)'}><List size={16} /></RowIcon>} label="Projekt">
          <Menu
            label="Projekt"
            value={v.projectId}
            onSelect={(x) => set('projectId', x)}
            items={[{ value: null as string | null, label: 'Kein Projekt' }, ...projects.map((p) => ({ value: p.id as string | null, label: p.name, icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> }))]}
          >
            <MenuValue>{project?.name ?? 'Kein Projekt'}</MenuValue>
          </Menu>
        </Row>
        {!isNew && (
          <Row icon={<RowIcon color="var(--indigo)"><Loader size={16} /></RowIcon>} label="Status">
            <Menu
              label="Status"
              value={v.status}
              onSelect={(x) => set('status', x)}
              items={[
                { value: 'todo' as Status, label: 'Offen' },
                { value: 'doing' as Status, label: 'In Arbeit' },
                { value: 'done' as Status, label: 'Erledigt' },
              ]}
            >
              <MenuValue>{{ todo: 'Offen', doing: 'In Arbeit', done: 'Erledigt' }[v.status]}</MenuValue>
            </Menu>
          </Row>
        )}
      </Group>

      {!isNew && task.status !== 'done' && (
        <Group footer={task.focusMinutes ? `Bisher ${task.focusMinutes} Min. fokussiert an dieser Aufgabe.` : undefined}>
          <button
            onClick={() => {
              save()
              navigate('focus')
              focusOn(task.id)
            }}
            className="row press w-full min-h-[50px] text-[17px] text-accent md:text-[15px]"
          >
            <Target size={18} /> Fokus-Session starten
          </button>
        </Group>
      )}
      {!isNew && <DangerRow label="Aufgabe löschen" onClick={remove} />}
    </Sheet>
  )
}

/* ───────── Event ───────── */

function EventSheet({ event, preset }: { event?: CalEvent; preset?: UIState['create']['preset'] }) {
  const projects = useStore(db, (s) => s.projects)
  const isNew = !event
  const [d, setD] = useState(() =>
    event
      ? { ...event }
      : {
          title: '',
          date: preset?.date ?? todayKey(),
          start: preset?.start ?? Math.min(22 * 60, (new Date().getHours() + 1) * 60),
          duration: 60,
          color: projects[0]?.color ?? '#007aff',
        },
  )
  const close = isNew ? closeCreate : closeEvent
  const cal = projects.find((p) => p.color === d.color)
  const end = Math.min(24 * 60 - 5, d.start + d.duration)

  const save = () => {
    if (!d.title.trim()) return
    const e = { title: d.title.trim(), date: d.date, start: d.start, duration: d.duration, color: d.color }
    if (isNew) {
      addEvent(e)
      toast(`Termin um ${fmtTime(d.start)} hinzugefügt`, 'check', { label: 'Kalender', run: () => navigate('calendar') })
    } else updateEvent(event.id, e)
    close()
  }
  const remove = () => {
    if (!event) return
    const e = deleteEvent(event.id)
    closeEvent()
    if (e) toast('Termin gelöscht', 'trash', { label: 'Widerrufen', run: () => restoreEvent(e) })
  }

  return (
    <Sheet title={isNew ? 'Neuer Termin' : 'Termin'} onClose={close} onConfirm={save} confirmDisabled={!d.title.trim()}>
      <Group>
        <div className="row">
          <input
            autoFocus={isNew}
            value={d.title}
            onChange={(e) => setD((x) => ({ ...x, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Titel"
            className="h-[50px] w-full bg-transparent text-[17px] outline-none placeholder:text-label-3 md:text-[15px]"
          />
        </div>
      </Group>
      <Group>
        <Row label="Datum">
          <DateField value={d.date} onChange={(date) => setD((x) => ({ ...x, date }))} />
        </Row>
        <Row label="Beginn">
          <TimeField label="Beginn" value={d.start} onChange={(start) => setD((x) => ({ ...x, start }))} />
        </Row>
        <Row label="Ende">
          <TimeField label="Ende" value={end} onChange={(e) => setD((x) => ({ ...x, duration: Math.max(15, e - x.start) }))} />
        </Row>
      </Group>
      <Group>
        <Row label="Kalender">
          <Menu
            label="Kalender"
            value={d.color}
            onSelect={(color) => setD((x) => ({ ...x, color }))}
            items={projects.map((p) => ({ value: p.color, label: p.name, icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> }))}
          >
            <MenuValue>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              {cal?.name ?? 'Andere'}
            </MenuValue>
          </Menu>
        </Row>
      </Group>
      {!isNew && <DangerRow label="Termin löschen" onClick={remove} />}
    </Sheet>
  )
}

/* ───────── mounting points ───────── */

export function CreateSheets() {
  const c = useStore(ui, (s) => s.create)
  return (
    <AnimatePresence>
      {c.open && (c.type === 'task' ? <TaskSheet key="new-task" preset={c.preset} /> : <EventSheet key="new-event" preset={c.preset} />)}
    </AnimatePresence>
  )
}

export function TaskEditor() {
  const id = useStore(ui, (s) => s.editTask)
  const task = useStore(db, (s) => (id ? s.tasks.find((t) => t.id === id) : undefined))
  return <AnimatePresence>{task && <TaskSheet key={task.id} task={task} />}</AnimatePresence>
}

export function EventEditor() {
  const id = useStore(ui, (s) => s.editEvent)
  const ev = useStore(db, (s) => (id ? s.events.find((e) => e.id === id) : undefined))
  return <AnimatePresence>{ev && <EventSheet key={ev.id} event={ev} />}</AnimatePresence>
}
