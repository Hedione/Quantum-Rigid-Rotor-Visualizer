import type { Settings } from '../types'
import { densityMoments, equalCoefficients, initialCoefficients, normalizeCoefficients, type WaveCoefficients } from './superposition'

/** Bloch coordinates of c₁|1⟩ + c₂|2⟩ in the selected orthonormal rotational basis. */
export function blochState(s: Settings, coefficients?: WaveCoefficients) {
  if (s.j === s.j2 && s.m === s.m2) return undefined
  const c = normalizeCoefficients(coefficients ?? (s.superposition && !s.coherentTransition ? equalCoefficients : initialCoefficients))
  const moments = densityMoments(c)
  return {
    x: moments.cosine, y: moments.sine, z: moments.first - moments.second,
    first: moments.first, second: moments.second,
    phase: moments.first * moments.second > 1e-12 ? Math.atan2(moments.sine, moments.cosine) : undefined,
  }
}
