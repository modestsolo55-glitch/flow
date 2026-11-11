import { memo, type MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { snappy } from '../lib/motion'

/** Reminders-style completion circle. */
export const Checkbox = memo(function Checkbox({
  checked,
  onToggle,
  color = 'var(--accent)',
  size = 22,
  label,
}: {
  checked: boolean
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void
  color?: string
  size?: number
  label?: string
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? 'Als offen markieren' : 'Als erledigt markieren')}
      data-nodrag
      onClick={(e) => {
        e.stopPropagation()
        onToggle(e)
      }}
      whileTap={{ scale: 0.86 }}
      transition={snappy}
      className="relative grid shrink-0 place-items-center rounded-full outline-none"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border-[1.5px] border-label-3" />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
        transition={snappy}
      />
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} className="relative">
        <motion.path
          d="M5.5 12.5l4 4L18.5 7.5"
          fill="none"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.25, delay: checked ? 0.05 : 0, ease: [0.3, 0.7, 0.3, 1] }}
        />
      </svg>
    </motion.button>
  )
})
