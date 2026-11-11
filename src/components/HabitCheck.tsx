import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { snappy } from '../lib/motion'

export const HabitCheck = forwardRef<HTMLButtonElement, { done: boolean; color: string; label: string; onToggle: () => void; size?: number }>(function HabitCheck(
  { done, color, label, onToggle, size = 30 },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.88 }}
      transition={snappy}
      aria-label={done ? `${label}: zurücksetzen` : `${label}: abhaken`}
      aria-pressed={done}
      onClick={onToggle}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${color}`, opacity: 0.45 }} />
      <motion.span className="absolute inset-0 rounded-full" style={{ background: color }} initial={false} animate={{ scale: done ? 1 : 0.5, opacity: done ? 1 : 0 }} transition={snappy} />
      <motion.span className="relative text-white" initial={false} animate={{ scale: done ? 1 : 0.5, opacity: done ? 1 : 0 }} transition={snappy}>
        <Check size={size * 0.55} strokeWidth={3} />
      </motion.span>
    </motion.button>
  )
})
