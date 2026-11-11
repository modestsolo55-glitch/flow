import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls, useIsPresent, useReducedMotion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useIsMd } from '../lib/hooks'
import { sheet } from '../lib/motion'
import { Glass, GlassButton } from './ui'

/**
 * Modal sheet as in iOS 26: glass ✕ on the left, title, ✓ on the right.
 * Phone: slides up from the bottom and can be dragged down to dismiss.
 * Larger screens: centered card that settles in.
 * Render inside <AnimatePresence>.
 */
export function Sheet({
  title,
  onClose,
  onConfirm,
  confirmDisabled,
  children,
}: {
  title: string
  onClose: () => void
  /** omitted → the ✓ button just closes (for live-editing sheets) */
  onConfirm?: () => void
  confirmDisabled?: boolean
  children: ReactNode
}) {
  const isMd = useIsMd()
  const reduce = useReducedMotion()
  const drag = useDragControls()
  const present = useIsPresent() // closing sheets let clicks through
  const cb = useRef({ onClose, onConfirm, confirmDisabled })
  cb.current = { onClose, onConfirm, confirmDisabled }

  useEffect(() => {
    if (!present) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cb.current.onClose()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !cb.current.confirmDisabled) {
        e.preventDefault()
        ;(cb.current.onConfirm ?? cb.current.onClose)()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [present])

  const confirm = onConfirm ?? onClose

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-2 pb-[max(8px,env(safe-area-inset-bottom))] md:items-center md:p-6" style={{ pointerEvents: present ? 'auto' : 'none' }}>
      <motion.div
        className="absolute inset-0 bg-[var(--dim)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
      />
      <Glass
        role="dialog"
        aria-modal="true"
        aria-label={title}
        radius={34}
        tint="var(--sheet-glass)"
        className="sheet flex max-h-[90dvh] w-full flex-col overflow-hidden md:max-h-[86vh] md:max-w-[460px]"
        initial={isMd ? { opacity: 0, scale: 0.96, y: 14 } : { y: '100%' }}
        animate={isMd ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
        exit={isMd ? { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.18 } } : { y: '100%' }}
        transition={reduce ? { duration: 0.2 } : sheet}
        drag={isMd ? false : 'y'}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => {
          if (i.offset.y > 120 || i.velocity.y > 600) onClose()
        }}
      >
        {/* grabber + header – also the drag handle on phones */}
        <div className="shrink-0 touch-none" onPointerDown={(e) => !isMd && drag.start(e)}>
          {!isMd && <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-fill-3" />}
          <div className="flex items-center gap-3 px-4 pb-2 pt-3">
            <GlassButton label="Abbrechen" size={40} onClick={onClose}>
              <X size={19} strokeWidth={2.3} />
            </GlassButton>
            <h2 className="flex-1 truncate text-center text-[17px] font-semibold">{title}</h2>
            <GlassButton label="Fertig" size={40} prominent={!confirmDisabled} disabled={confirmDisabled} onClick={confirm}>
              <Check size={19} strokeWidth={2.6} />
            </GlassButton>
          </div>
        </div>
        <div className="overflow-y-auto px-4 pb-4 pt-2">{children}</div>
      </Glass>
    </div>,
    document.body,
  )
}

/** Inset-grouped section inside a sheet */
export function Group({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="list">{children}</div>
      {footer && <p className="t-sub mt-1.5 px-4">{footer}</p>}
    </div>
  )
}
