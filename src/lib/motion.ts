import type { Transition } from 'framer-motion'

/*
 * Springs modelled on SwiftUI's presets (response / dampingFraction).
 * Mostly critically damped: things arrive with weight instead of wobbling.
 */

/** .smooth (0.5 / 1.0) – surfaces, content, layout changes */
export const smooth: Transition = { type: 'spring', stiffness: 160, damping: 25, mass: 1 }
/** .snappy (0.35 / 0.86) – selections, toggles, controls */
export const snappy: Transition = { type: 'spring', stiffness: 320, damping: 31, mass: 1 }
/** sheets – heavy, settles without overshoot */
export const sheet: Transition = { type: 'spring', stiffness: 280, damping: 34, mass: 1.15 }
/** press feedback */
export const press: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }

/** kept for existing imports */
export const spring = snappy
export const softSpring = smooth
export const bouncy: Transition = { type: 'spring', stiffness: 420, damping: 28, mass: 0.9 }
