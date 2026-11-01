import type { Settings } from '../types'
import { getPolarAmplitude } from './quantum'
import { integrateGauss } from './integration'

export type CoherentState = Pick<Settings, 'j' | 'm'> & Partial<Pick<Settings, 'superposition' | 'j2' | 'm2'>>
export interface DistributionTheory {
  polar: number[]; theta: number[]; azimuth: number[]; azimuthBinned: boolean; azimuthContrast: number;
  azimuthBins?: number[]; azimuthOrder?: number;
  evolution?: { polarBase: number[]; polarCos: number[]; thetaBase: number[]; thetaCos: number[]; azimuthBase: number; azimuthCos: number[]; azimuthSin: number[]; azimuthBinCos?: number[]; azimuthBinSin?: number[] }
}

export function signedPolarAmplitude(j: number, m: number) {
  const amplitude = getPolarAmplitude(j, m), sign = m < 0 ? (-1) ** Math.abs(m) : 1
  return (u: number) => sign * amplitude(u)
}

/** Equal positive coefficients at t=0; identical terms normalize back to one eigenstate. */
export function createAngularWavefunction(state: CoherentState) {
  const enabled = state.superposition ?? false, j2 = state.j2 ?? 2, m2 = state.m2 ?? 1
  const a = signedPolarAmplitude(state.j, state.m), b = enabled ? signedPolarAmplitude(j2, m2) : undefined
  const duplicate = enabled && state.j === j2 && state.m === m2
  const normalization = enabled ? duplicate ? 2 : Math.SQRT2 : 1
  const normalizationSquared = normalization * normalization
  const polarDensity = (u: number, relativePhase = 0) => {
    const first = a(u), second = b?.(u) ?? 0
    return 2 * Math.PI * (first * first + second * second + (enabled && state.m === m2 ? 2 * first * second * Math.cos(relativePhase) : 0)) / normalizationSquared
  }
  const evaluate = (u: number, phi: number, firstPhase = 0, secondPhase = 0) => {
    const first = a(u), second = b?.(u) ?? 0
    const re = (first * Math.cos(state.m * phi - firstPhase) + second * Math.cos(m2 * phi - secondPhase)) / normalization
    const im = (first * Math.sin(state.m * phi - firstPhase) + second * Math.sin(m2 * phi - secondPhase)) / normalization
    return { re, im, probability: re * re + im * im, magnitude: Math.hypot(re, im), phase: Math.atan2(im, re) }
  }
  return { a, b, normalization, normalizationSquared, duplicate, polarDensity, evaluate }
}

/** Signed polar overlap controls interference in the azimuthal marginal. */
export function azimuthalOverlap(state: CoherentState) {
  if (!state.superposition) return 0
  const j2 = state.j2 ?? 2, m2 = state.m2 ?? 1
  if (state.m === m2) return state.j === j2 ? 1 / (2 * Math.PI) : 0
  if ((state.j + Math.abs(state.m) + j2 + Math.abs(m2)) % 2) return 0
  if (state.j === j2 && Math.abs(state.m) === Math.abs(m2)) return (-1) ** Math.abs(state.m) / (2 * Math.PI)
  const { a, b } = createAngularWavefunction(state)
  // Integrating in theta avoids square-root endpoint singularities in u.
  const n = 8192, step = Math.PI / n
  let sum = 0
  for (let i = 1; i < n; i++) {
    const theta = i * step, u = Math.cos(theta)
    sum += (i % 2 ? 4 : 2) * a(u) * b!(u) * Math.sin(theta)
  }
  return sum * step / 3
}

export function prepareSuperpositionDistribution(state: CoherentState, bins = 40): DistributionTheory {
  const wave = createAngularWavefunction(state), degree = Math.max(64, state.j + 1, (state.j2 ?? 0) + 1)
  const polar = Array.from({ length: bins }, (_, i) => integrateGauss(wave.polarDensity, -1 + 2 * i / bins, -1 + 2 * (i + 1) / bins, degree) * bins / 2)
  const theta = Array.from({ length: bins }, (_, i) => integrateGauss(wave.polarDensity, Math.cos((i + 1) * Math.PI / bins), Math.cos(i * Math.PI / bins), degree) * bins / Math.PI)
  const delta = state.m - (state.m2 ?? 1), overlap = azimuthalOverlap(state)
  const base = state.superposition ? 1 / (Math.PI * wave.normalizationSquared) : 1 / (2 * Math.PI)
  const interference = state.superposition ? 2 * overlap / wave.normalizationSquared : 0
  const azimuthBinned = Math.abs(delta) > 20
  const phiBins = Array.from({ length: bins }, (_, i) => {
    const lo = 2 * Math.PI * i / bins, hi = 2 * Math.PI * (i + 1) / bins
    return base + interference * (delta === 0 ? 1 : (Math.sin(delta * hi) - Math.sin(delta * lo)) / (delta * (hi - lo)))
  })
  const azimuth = Array.from({ length: 401 }, (_, i) => Math.max(0, azimuthBinned ? phiBins[Math.min(bins - 1, Math.floor(i / 400 * bins))] : base + interference * Math.cos(delta * i * 2 * Math.PI / 400)))
  const baseDensity = (u: number) => 2 * Math.PI * (wave.a(u) ** 2 + (wave.b?.(u) ?? 0) ** 2) / wave.normalizationSquared
  const polarBase = Array.from({ length: bins }, (_, i) => integrateGauss(baseDensity, -1 + 2 * i / bins, -1 + 2 * (i + 1) / bins, degree) * bins / 2)
  const thetaBase = Array.from({ length: bins }, (_, i) => integrateGauss(baseDensity, Math.cos((i + 1) * Math.PI / bins), Math.cos(i * Math.PI / bins), degree) * bins / Math.PI)
  const harmonic = (i: number, sine: boolean) => {
    const phi = i * 2 * Math.PI / 400
    if (!azimuthBinned) return interference * (sine ? Math.sin(delta * phi) : Math.cos(delta * phi))
    const bin = Math.min(bins - 1, Math.floor(i / 400 * bins)), lo = 2 * Math.PI * bin / bins, hi = 2 * Math.PI * (bin + 1) / bins
    return interference * (sine ? (Math.cos(delta * lo) - Math.cos(delta * hi)) : (Math.sin(delta * hi) - Math.sin(delta * lo))) / (delta * (hi - lo))
  }
  // Duplicate terms share an energy; their relative phase always remains zero.
  const azimuthBinSin = Array.from({ length: bins }, (_, i) => {
    const lo = 2 * Math.PI * i / bins, hi = 2 * Math.PI * (i + 1) / bins
    return delta === 0 ? 0 : interference * (Math.cos(delta * lo) - Math.cos(delta * hi)) / (delta * (hi - lo))
  })
  const evolution = wave.duplicate ? undefined : { polarBase, polarCos: polar.map((p, i) => p - polarBase[i]), thetaBase, thetaCos: theta.map((p, i) => p - thetaBase[i]), azimuthBase: base, azimuthCos: azimuth.map((_, i) => harmonic(i, false)), azimuthSin: azimuth.map((_, i) => harmonic(i, true)), azimuthBinCos: phiBins.map(p => p - base), azimuthBinSin }
  return { polar, theta, azimuth, azimuthBinned, azimuthContrast: Math.abs(interference), azimuthBins: phiBins, azimuthOrder: Math.abs(delta), evolution }
}

/** Fourier coefficients also give the exact expected theory for accumulated times. */
export function distributionAtPhase(theory: DistributionTheory, cosine: number, sine: number): DistributionTheory {
  const e = theory.evolution
  if (!e) return theory
  return { ...theory, polar: e.polarBase.map((p, i) => Math.max(0, p + e.polarCos[i] * cosine)), theta: e.thetaBase.map((p, i) => Math.max(0, p + e.thetaCos[i] * cosine)), azimuth: e.azimuthCos.map((p, i) => Math.max(0, e.azimuthBase + p * cosine + e.azimuthSin[i] * sine)), azimuthBins: e.azimuthBinCos?.map((p, i) => Math.max(0, e.azimuthBase + p * cosine + (e.azimuthBinSin?.[i] ?? 0) * sine)) }
}
