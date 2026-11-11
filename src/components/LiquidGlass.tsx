import { forwardRef, useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../lib/utils'

/*
 * Liquid Glass
 * ────────────
 * 1. Refraction: an SVG filter used as `backdrop-filter` displaces the backdrop
 *    with a per-element lens map – the rim bends what is behind it, the centre
 *    stays clear. Chromium supports SVG filters in backdrop-filter; other engines
 *    get a frosted fallback with the same rim and highlights.
 * 2. Thickness: inner glow + top sheen.
 * 3. Specular rim: a conic highlight that rotates towards the pointer (transform only).
 */

export const REFRACTION =
  typeof navigator !== 'undefined' && /Chrome\/\d+/.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent)

const mapCache = new Map<string, string>()

/** Lens map: R/G encode the displacement direction, strongest at the rim. */
function lensMap(fullW: number, fullH: number, fullR: number, fullBezel: number) {
  // computed at half resolution – the displacement is smooth, feImage scales it up
  const w = Math.max(2, Math.ceil(fullW / 2))
  const h = Math.max(2, Math.ceil(fullH / 2))
  const r = fullR / 2
  const bezel = fullBezel / 2
  const key = `${w}x${h}x${r}x${bezel}`
  const hit = mapCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(w, h)
  const d = img.data
  const hw = w / 2
  const hh = h / 2
  const ir = Math.min(r, hw, hh)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hw
      const py = y + 0.5 - hh
      const qx = Math.abs(px) - (hw - ir)
      const qy = Math.abs(py) - (hh - ir)
      const ox = Math.max(qx, 0)
      const oy = Math.max(qy, 0)
      // distance from the edge towards the inside (rounded-rect SDF)
      const dist = ir - (Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0))
      let dx = 0
      let dy = 0
      if (dist >= 0 && dist < bezel) {
        let nx: number
        let ny: number
        if (ox > 0 || oy > 0) {
          const L = Math.hypot(ox, oy) || 1
          nx = (ox / L) * Math.sign(px)
          ny = (oy / L) * Math.sign(py)
        } else if (qx > qy) {
          nx = Math.sign(px)
          ny = 0
        } else {
          nx = 0
          ny = Math.sign(py)
        }
        const t = 1 - dist / bezel
        const m = t * t * t // convex profile: flat centre, steep rim
        dx = -nx * m
        dy = -ny * m
      }
      const i = (y * w + x) * 4
      d[i] = 128 + dx * 127
      d[i + 1] = 128 + dy * 127
      d[i + 2] = 128
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL()
  if (mapCache.size > 48) mapCache.delete(mapCache.keys().next().value as string)
  mapCache.set(key, url)
  return url
}

const LIGHT_REST = -38 // light comes from the top left

export type GlassProps = HTMLMotionProps<'div'> & {
  radius?: number | 'full'
  /** regular = frosted for text, clear = almost transparent for controls */
  variant?: 'regular' | 'clear'
  /** rim highlight follows the pointer */
  interactive?: boolean
  /** optional tint colour (e.g. accent for a prominent button) */
  tint?: string
  /** live refraction; by default only for smaller surfaces (large panels would cost a full-screen filter every frame) */
  refract?: boolean
}

/** above this area the rim bending is barely visible but very expensive */
const MAX_REFRACT_AREA = 140_000

export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { radius = 24, variant = 'regular', interactive, tint, refract, className, style, children, onPointerMove, onPointerLeave, ...rest },
  fwd,
) {
  const local = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const fid = 'lg' + useId().replace(/[^a-zA-Z0-9]/g, '')

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      local.current = el
      if (typeof fwd === 'function') fwd(el)
      else if (fwd) fwd.current = el
    },
    [fwd],
  )

  useLayoutEffect(() => {
    const el = local.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // rim light angle – unwrapped so the spring always takes the short way round
  const angle = useMotionValue(LIGHT_REST)
  const rot = useSpring(angle, { stiffness: 140, damping: 22 })
  const towards = (deg: number) => {
    const cur = angle.get()
    let next = deg
    while (next - cur > 180) next -= 360
    while (next - cur < -180) next += 360
    angle.set(next)
  }

  const R = radius === 'full' ? (size ? Math.min(size.w, size.h) / 2 : 999) : radius
  const bezel = Math.max(6, Math.min(R * 0.9, variant === 'clear' ? 20 : 24))
  const wantsRefraction = refract ?? (size ? size.w * size.h <= MAX_REFRACT_AREA : false)
  const map = REFRACTION && wantsRefraction && size && size.w > 2 && size.h > 2 ? lensMap(size.w, size.h, Math.round(R), Math.round(bezel)) : ''
  const diag = size ? Math.ceil(Math.hypot(size.w, size.h)) : 0

  return (
    <motion.div
      ref={setRef}
      className={cn('lg', variant === 'clear' ? 'lg-clear' : 'lg-regular', className)}
      style={{
        borderRadius: radius === 'full' ? 9999 : radius,
        ...(map ? { backdropFilter: `url(#${fid})`, WebkitBackdropFilter: `url(#${fid})` } : null),
        ...style,
      }}
      onPointerMove={(e) => {
        if (interactive && e.pointerType === 'mouse') {
          const r = e.currentTarget.getBoundingClientRect()
          towards((Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90)
        }
        onPointerMove?.(e)
      }}
      onPointerLeave={(e) => {
        if (interactive) towards(LIGHT_REST)
        onPointerLeave?.(e)
      }}
      {...rest}
    >
      {map && size && (
        <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
          <filter id={fid} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={variant === 'clear' ? 0.5 : 2.5} result="soft" />
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="lens" />
            <feDisplacementMap in="soft" in2="lens" scale={bezel * (variant === 'clear' ? 2.8 : 2.4)} xChannelSelector="R" yChannelSelector="G" result="bent" />
            <feColorMatrix in="bent" type="saturate" values={variant === 'clear' ? '1.5' : '1.8'} />
          </filter>
        </svg>
      )}
      <span aria-hidden className="lg-layer lg-tint" style={tint ? { background: tint } : undefined} />
      <span aria-hidden className="lg-layer lg-shine" />
      <span aria-hidden className="lg-layer lg-rim">
        {diag > 0 && <motion.span className="lg-rim-light" style={{ width: diag, height: diag, marginLeft: -diag / 2, marginTop: -diag / 2, rotate: rot }} />}
      </span>
      {children as ReactNode}
    </motion.div>
  )
})

/**
 * Round glass control. Pressing makes the glass swell and spring back
 * with a little elasticity – the "liquid" response of iOS 26 controls.
 */
export const GlassButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<'button'> & { label: string; size?: number; prominent?: boolean; variant?: 'regular' | 'clear' }
>(function GlassButton({ label, size = 40, prominent, variant = 'clear', className, children, style, type = 'button', ...p }, ref) {
  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      whileTap={{ scale: 1.12 }}
      transition={{ type: 'spring', stiffness: 520, damping: 17, mass: 0.7 }}
      className={cn('relative grid shrink-0 select-none place-items-center rounded-full outline-none disabled:opacity-40', prominent ? 'text-white' : 'text-label', className)}
      style={{ width: size, height: size, ...style }}
      {...p}
    >
      <Glass radius="full" variant={variant} interactive tint={prominent ? 'color-mix(in srgb, var(--accent) 88%, transparent)' : undefined} className="!absolute inset-0" />
      <span className="pointer-events-none relative grid place-items-center">{children as ReactNode}</span>
    </motion.button>
  )
})
