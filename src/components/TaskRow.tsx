import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Repeat2 } from 'lucide-react'
import type { Project, Task } from '../types'
import { Checkbox } from './Checkbox'
import { celebrate } from './Effects'
import { openTask, toggleTask } from '../actions'
import { diffDays, fmtTime, REPEAT_LABEL, relativeDay, todayKey } from '../lib/date'
import { cn } from '../lib/utils'

/**
 * Reminders-style row. Completing: the circle fills, the row stays for a
 * moment (so you can undo with a second tap), then fades and the list closes up.
 */
export const TaskRow = memo(function TaskRow({ task, project, showProject = true }: { task: Task; project?: Project; showProject?: boolean }) {
  const done = task.status === 'done'
  const [completing, setCompleting] = useState(false)
  const checked = done || completing
  const cbRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onToggle = () => {
    if (done) return toggleTask(task.id)
    if (completing) {
      window.clearTimeout(timer.current)
      setCompleting(false)
      return
    }
    setCompleting(true)
    celebrate(cbRef.current, project?.color)
    timer.current = window.setTimeout(() => {
      toggleTask(task.id)
      setCompleting(false)
    }, 1000)
  }

  const t = todayKey()
  const overdue = !done && diffDays(task.schedule?.date ?? task.due ?? t, t) < 0
  const when = task.schedule ? `${relativeDay(task.schedule.date)}, ${fmtTime(task.schedule.start)}` : task.due ? relativeDay(task.due) : null

  return (
    <motion.div
      className="row press min-h-[56px] cursor-default items-start py-[11px]"
      style={{ ['--sep-inset' as string]: '50px' }}
      onClick={() => openTask(task.id)}
      initial={false}
      animate={{ opacity: completing ? [1, 1, 0] : 1 }}
      transition={completing ? { duration: 1, times: [0, 0.72, 1], ease: 'easeOut' } : { duration: 0.2 }}
    >
      <span ref={cbRef} className="mt-[1px]">
        <Checkbox checked={checked} onToggle={onToggle} color={project?.color} />
      </span>
      <div className="min-w-0 flex-1">
        <motion.div className="t-body flex min-w-0 items-baseline gap-1" initial={false} animate={{ opacity: checked ? 0.4 : 1 }} transition={{ duration: 0.2 }}>
          {task.priority > 0 && <span className="shrink-0 font-semibold text-accent">{'!'.repeat(task.priority)}</span>}
          <span className="truncate">{task.title}</span>
        </motion.div>
        {(when || (showProject && project) || task.status === 'doing' || task.repeat) && (
          <div className="t-sub mt-0.5 flex min-w-0 items-center gap-1 truncate">
            {when && <span className={cn(overdue && 'text-ios-red')}>{when}</span>}
            {when && showProject && project && <span>·</span>}
            {showProject && project && <span className="truncate">{project.name}</span>}
            {task.repeat && (
              <span className="flex shrink-0 items-center gap-0.5" title={REPEAT_LABEL[task.repeat]}>
                <Repeat2 size={12} />
              </span>
            )}
            {task.status === 'doing' && (
              <span className="ml-1 rounded-full bg-[color-mix(in_srgb,var(--orange)_16%,transparent)] px-1.5 text-[11px] font-semibold leading-[17px] text-ios-orange">In Arbeit</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
})
