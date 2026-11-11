import { memo, useEffect, useId, useRef, type ReactNode } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'framer-motion'

/** Counts up/down smoothly; writes straight to the DOM (no re-render per frame). */
export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  format = (n: number) => String(Math.round(n)),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const mv = useSpring(0, { stiffness: 80, damping: 20, mass: 1 })
  const ref = useRef<HTMLSpanElement>(null)
  const fmt = useRef(format)
  fmt.current = format

  useEffect(() => {
    if (reduce) mv.jump(value)
    else mv.set(value)
  }, [value, reduce, mv])

  useMotionValueEvent(mv, 'change', (v) => {
    if (ref.current) ref.current.textContent = fmt.current(v)
  })

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(reduce ? value : 0)}
    </span>
  )
})

export const ProgressRing = memo(function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  colors = ['#6d8bff', '#a46bff', '#ff6fb5'],
  children,
}: {
  value: number
  size?: number
  stroke?: number
  colors?: string[]
  children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  const reduce = useReducedMotion()
  const mv = useSpring(0, { stiffness: 60, damping: 18 })
  useEffect(() => {
    const v = Math.max(0, Math.min(1, value))
    if (reduce) mv.jump(v)
    else mv.set(v)
  }, [value, reduce, mv])
  const opacity = useTransform(mv, (v) => (v > 0.002 ? 1 : 0))
  const r = (size - stroke) / 2

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="1" y2="1">
            {colors.map((c, i) => (
              <stop key={c + i} offset={i / Math.max(1, colors.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-900/[0.07] dark:stroke-white/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#rg-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ pathLength: mv, opacity }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
})
