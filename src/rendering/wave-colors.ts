import * as THREE from 'three'
import type { SurfaceQuantity } from '../types'

export const WAVE_COLORS = {
  realPositive: '#72d6b0', realNegative: '#ed93b6',
  imaginaryPositive: '#8faaf0', imaginaryNegative: '#f0b887',
  density: '#72d6b0',
} as const

const colors = Object.fromEntries(Object.entries(WAVE_COLORS).map(([key, value]) => [key, new THREE.Color(value)])) as Record<keyof typeof WAVE_COLORS, THREE.Color>

/** One cyclic palette for phase and the corresponding signed component views. */
export function wavefunctionColor(re: number, im: number, quantity: SurfaceQuantity, target: THREE.Color) {
  const real = re < 0 ? colors.realNegative : colors.realPositive
  const imaginary = im < 0 ? colors.imaginaryNegative : colors.imaginaryPositive
  if (quantity === 'probability' || quantity === 'jointProbability') return target.copy(colors.density)
  if (quantity === 'real') return target.copy(real)
  if (quantity === 'imaginary') return target.copy(imaginary)
  return target.copy(real).lerp(imaginary, Math.abs(im) / (Math.abs(re) + Math.abs(im) || 1))
}
