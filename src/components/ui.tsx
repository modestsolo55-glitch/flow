import { createContext, forwardRef, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent, type HTMLMotionProps } from 'framer-motion'
import { Glass, GlassButton } from './LiquidGlass'

export { Glass, GlassButton }
import { Check, ChevronsUpDown, Minus, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import { press, snappy } from '../lib/motion'
import { fmtDate, fmtTime } from '../lib/date'

/* ───────── Buttons ───────── */

type Variant = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive'
const VARIANTS: Record<Variant, string> = {
  filled: 'bg-accent text-white font-semibold',
  tinted: 'text-accent font-semibold bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]',
  gray: 'bg-fill text-label font-medium',
  plain: 'text-accent font-medium',
  destructive: 'text-ios-red font-medium',
}

export const Button = forwardRef<HTMLButtonElement, HTMLMotionProps<'button'> & { variant?: Variant; size?: 'sm' | 'md' }>(function Button(
  { variant = 'filled', size = 'md', className, type = 'button', ...p },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.97, opacity: 0.75 }}
      transition={press}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-8 px-3.5 text-[14px]' : 'h-10 px-5 text-[15px]',
        VARIANTS[variant],
        className,
      )}
      {...p}
    />
  )
})

/* ───────── Segmented control (iOS) ───────── */

export interface SegOption<T extends string> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId,
  className,
  slide = true,
}: {
  value: T
  onChange: (v: T) => void
  options: SegOption<T>[]
  layoutId: string
  className?: string
  /** false inside sheets/overlays: a shared-layout thumb there can keep the overlay from closing */
  slide?: boolean
}) {
  return (
    <div className={cn('relative inline-flex h-10 shrink-0 items-center rounded-full p-1', className)} role="tablist">
      <Glass radius="full" variant="clear" interactive className="!absolute inset-0" />
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className="relative h-8 flex-1 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold outline-none"
          >
            {active && (slide ? <LiquidPill layoutId={layoutId} /> : <span className="lg-pill absolute inset-0 rounded-full" />)}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Elastic jelly spring – the selection droplet stretches while it travels. */
export const jelly = { type: 'spring', stiffness: 360, damping: 15, mass: 0.8 } as const

/** Moving selection "droplet": stretches when it leaves, wobbles into place. */
export function LiquidPill({ layoutId, className }: { layoutId: string; className?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      className={cn('lg-pill absolute inset-0 rounded-full', className)}
      initial={{ scaleX: 1.22, scaleY: 0.86 }}
      animate={{ scaleX: 1, scaleY: 1 }}
      transition={{ layout: snappy, scaleX: jelly, scaleY: jelly }}
      style={{ borderRadius: 999 }}
    />
  )
}

/* ───────── Switch (iOS) ───────── */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const [down, setDown] = useState(false)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-fill-3 outline-none"
    >
      <motion.span className="absolute inset-0 rounded-full bg-ios-green" initial={false} animate={{ opacity: checked ? 1 : 0 }} transition={{ duration: 0.2 }} />
      {/* the thumb stretches while pressed, like the liquid iOS 26 switch */}
      <motion.span
        className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
        style={{ originX: checked ? 1 : 0 }}
        initial={false}
        animate={{ x: checked ? 20 : 0, scaleX: down ? 1.2 : 1 }}
        transition={snappy}
      />
    </button>
  )
}

/* ───────── Stepper (iOS) ───────── */

export function Stepper({ onDec, onInc }: { onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex h-8 shrink-0 items-center rounded-[9px] bg-fill">
      <motion.button whileTap={{ opacity: 0.4 }} onClick={onDec} aria-label="Weniger" className="grid h-8 w-11 place-items-center">
        <Minus size={16} strokeWidth={2.4} />
      </motion.button>
      <span className="h-[18px] w-px bg-sep" />
      <motion.button whileTap={{ opacity: 0.4 }} onClick={onInc} aria-label="Mehr" className="grid h-8 w-11 place-items-center">
        <Plus size={16} strokeWidth={2.4} />
      </motion.button>
    </div>
  )
}

/* ───────── Pop-up menu (morphs out of its button) ───────── */

export interface MenuItem<T> {
  value: T
  label: string
  icon?: ReactNode
  destructive?: boolean
}

export function Menu<T>({
  value,
  items,
  onSelect,
  children,
  className,
  label,
  align = 'end',
  showCheck = true,
}: {
  value?: T
  items: MenuItem<T>[]
  onSelect: (v: T) => void
  children: ReactNode
  className?: string
  label: string
  align?: 'start' | 'end'
  showCheck?: boolean
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!rect}
        whileTap={{ opacity: 0.6 }}
        onClick={(e) => {
          e.stopPropagation()
          setRect(rect ? null : ref.current!.getBoundingClientRect())
        }}
        className={cn('outline-none', className)}
      >
        {children}
      </motion.button>
      {createPortal(
        <AnimatePresence>
          {rect && (
            <MenuPopover
              rect={rect}
              align={align}
              items={items}
              value={value}
              showCheck={showCheck}
              onClose={() => setRect(null)}
              onSelect={(v) => {
                setRect(null)
                onSelect(v)
              }}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function MenuPopover<T>({
  rect,
  align,
  items,
  value,
  showCheck,
  onClose,
  onSelect,
}: {
  rect: DOMRect
  align: 'start' | 'end'
  items: MenuItem<T>[]
  value?: T
  showCheck: boolean
  onClose: () => void
  onSelect: (v: T) => void
}) {
  const W = 232
  const H = items.length * 40 + 12
  const up = rect.bottom + 8 + H > innerHeight - 8 && rect.top - 8 - H > 8
  const left = Math.max(8, Math.min(innerWidth - W - 8, align === 'end' ? rect.right - W : rect.left))
  const originX = (align === 'end' ? rect.right : rect.left) - left
  const close = useRef(onClose)
  close.current = onClose
  // while fading out it must not swallow the next click
  const present = useIsPresent()

  useEffect(() => {
    if (!present) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        close.current()
      }
    }
    const scroll = () => close.current()
    window.addEventListener('keydown', k, true)
    window.addEventListener('resize', scroll)
    window.addEventListener('scroll', scroll, true)
    return () => {
      window.removeEventListener('keydown', k, true)
      window.removeEventListener('resize', scroll)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [present])

  return (
    <div className="fixed inset-0 z-[80]" style={{ pointerEvents: present ? 'auto' : 'none' }} onPointerDown={() => close.current()}>
      <Glass
        role="menu"
        radius={22}
        interactive
        onPointerDown={(e) => e.stopPropagation()}
        className="!absolute p-1.5"
        style={{ left, width: W, ...(up ? { bottom: innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }), originX: `${originX}px`, originY: up ? '100%' : '0%' }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.14 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      >
        {items.map((it, i) => {
          const sel = showCheck && value !== undefined && it.value === value
          return (
            <button
              key={i}
              role="menuitemradio"
              aria-checked={sel}
              onClick={() => onSelect(it.value)}
              className={cn('press relative flex h-10 w-full items-center gap-2.5 rounded-[11px] px-2.5 text-left text-[15px]', it.destructive && 'text-ios-red')}
            >
              {showCheck && <span className="grid w-4 place-items-center">{sel && <Check size={15} strokeWidth={2.6} />}</span>}
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.icon && <span className="grid w-5 shrink-0 place-items-center">{it.icon}</span>}
            </button>
          )
        })}
      </Glass>
    </div>
  )
}

/** Value pill used as a menu trigger inside form rows. */
export function MenuValue({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[15px] text-label-2">
      {children}
      <ChevronsUpDown size={14} className="opacity-70" />
    </span>
  )
}

/* ───────── Date / time pills (native pickers underneath) ───────── */

function openPicker(el: HTMLInputElement | null) {
  try {
    el?.showPicker()
  } catch {
    /* unsupported – the input itself still receives the tap */
  }
}

export function DateField({ value, onChange, label = 'Datum' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <label className="pill cursor-pointer">
      {fmtDate(value, { day: 'numeric', month: 'short', year: 'numeric' })}
      <input
        ref={ref}
        aria-label={label}
        type="date"
        value={value}
        onClick={() => openPicker(ref.current)}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}

export function TimeField({ value, onChange, label = 'Uhrzeit' }: { value: number; onChange: (v: number) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <label className="pill cursor-pointer">
      {fmtTime(value)}
      <input
        ref={ref}
        aria-label={label}
        type="time"
        step={300}
        value={fmtTime(value)}
        onClick={() => openPicker(ref.current)}
        onChange={(e) => {
          const [h, m] = e.target.value.split(':').map(Number)
          if (!Number.isNaN(h)) onChange(h * 60 + (m || 0))
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}

/* ───────── Layout ───────── */

/** The app provides a fixed toolbar slot; views portal their actions into it. */
export const ToolbarSlot = createContext<HTMLElement | null>(null)

/**
 * Large title like iOS / macOS. Toolbar actions float as glass controls in the
 * fixed toolbar (top right) – content scrolls underneath and is refracted.
 */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  const slot = useContext(ToolbarSlot)
  return (
    <header className="mb-5 pt-12 md:mb-7 md:pt-0">
      <h1 className="t-large">{title}</h1>
      {subtitle && <p className="mt-0.5 text-[15px] text-label-2">{subtitle}</p>}
      {actions &&
        slot &&
        createPortal(
          <motion.div className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }} transition={snappy}>
            {actions}
          </motion.div>,
          slot,
        )}
    </header>
  )
}

export function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-baseline justify-between gap-2 px-1">
      <h2 className="t-section">{children}</h2>
      {action}
    </div>
  )
}

/** Settings-style rounded square icon */
export function RowIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white" style={{ background: color }}>
      {children}
    </span>
  )
}
