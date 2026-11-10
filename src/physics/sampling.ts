import { getPolarAmplitude, LOW_J_LIMIT, validateState } from './quantum'
import { densityMoments, equalCoefficients, signedPolarAmplitude, type DensityMoments, type WaveCoefficients } from './superposition'
import { HISTOGRAM_BINS, HISTOGRAM_BIN_OPTIONS, MAX_HISTOGRAM_BINS, rebinCounts } from './histograms'
import { defaultSettings } from '../types'

export const MAX_ROTORS = 10000
export const DEFAULT_ROTORS = defaultSettings.count
export { HISTOGRAM_BINS } from './histograms'
const CDF_RESOLUTION = 8192
const cache = new Map<string, Float64Array>()
const angularTables = new WeakSet<Float64Array>()
const cellSlopes = new WeakMap<Float64Array, { left: Float64Array; right: Float64Array }>()

const cellCDF = (t: number, a: number, b: number) => t * (a + t * (3 - 2 * a - b + t * (a + b - 2)))
const cellPDF = (t: number, a: number, b: number) => a + 2 * t * (3 - 2 * a - b) + 3 * t * t * (a + b - 2)

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function getOrientationCDF(j: number, m: number): Float64Array {
  validateState(j, m)
  const key = `${j}:${Math.abs(m)}`
  const existing = cache.get(key)
  if (existing) return existing
  const angular = j > LOW_J_LIMIT
  const resolution = angular ? 16384 : CDF_RESOLUTION
  const cdf = new Float64Array(resolution + 1)
  const slopes = angular ? { left: new Float64Array(resolution), right: new Float64Array(resolution) } : undefined
  const step = (angular ? Math.PI : 2) / resolution
  const amplitude = getPolarAmplitude(j, m)
  const density = (i: number) => {
    const coordinate = i * step
    const u = angular ? -Math.cos(coordinate) : -1 + coordinate
    const p = amplitude(u)
    return 2 * Math.PI * p * p * (angular ? Math.sin(coordinate) : 1)
  }
  let previous = density(0)
  for (let i = 1; i <= resolution; i++) {
    const current = density(i)
    if (slopes) {
      // Simpson cell masses plus a monotone Hermite CDF resolve narrow high-J nodes.
      const average = (previous + 4 * density(i - 0.5) + current) / 6
      cdf[i] = cdf[i - 1] + average * step
      let a = average > 0 ? previous / average : 1, b = average > 0 ? current / average : 1
      let minimum = Math.min(a, b)
      if (a + b > 2) {
        const vertex = -(3 - 2 * a - b) / (3 * (a + b - 2))
        if (vertex > 0 && vertex < 1) minimum = Math.min(minimum, cellPDF(vertex, a, b))
      }
      if (minimum < 0) {
        const blend = 1 / (1 - minimum + 1e-12)
        a = 1 + blend * (a - 1); b = 1 + blend * (b - 1)
      }
      slopes.left[i - 1] = a; slopes.right[i - 1] = b
    } else cdf[i] = cdf[i - 1] + (previous + current) * step / 2
    previous = current
  }
  const integral = cdf[resolution]
  if (!(integral > 0) || !Number.isFinite(integral)) throw new Error('Invalid orientation probability integral')
  for (let i = 1; i <= resolution; i++) cdf[i] /= integral
  if (angular) angularTables.add(cdf)
  if (slopes) cellSlopes.set(cdf, slopes)
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(key, cdf)
  return cdf
}

export function inverseCDF(cdf: Float64Array, p: number): number {
  if (p <= 0) return -1
  if (p >= 1) return 1
  let low = 0
  let high = cdf.length - 1
  while (high - low > 1) {
    const mid = (low + high) >>> 1
    if (cdf[mid] <= p) low = mid
    else high = mid
  }
  const interval = cdf[high] - cdf[low]
  const fractionOfMass = interval > 0 ? (p - cdf[low]) / interval : 0
  let t = fractionOfMass
  const slopes = cellSlopes.get(cdf)
  if (slopes && interval > 0) {
    const a = slopes.left[low], b = slopes.right[low]
    let left = 0, right = 1
    for (let iteration = 0; iteration < 16; iteration++) {
      const error = cellCDF(t, a, b) - fractionOfMass
      if (Math.abs(error) < 1e-13) break
      if (error < 0) left = t
      else right = t
      const derivative = cellPDF(t, a, b)
      const next = derivative > 1e-12 ? t - error / derivative : NaN
      t = next > left && next < right ? next : (left + right) / 2
    }
  }
  const fraction = (low + t) / (cdf.length - 1)
  return angularTables.has(cdf) ? -Math.cos(Math.PI * fraction) : -1 + 2 * fraction
}

export function cdfAtU(cdf: Float64Array, u: number): number {
  u = Math.max(-1, Math.min(1, u))
  const fraction = angularTables.has(cdf) ? Math.acos(-u) / Math.PI : (u + 1) / 2
  const index = fraction * (cdf.length - 1)
  const low = Math.floor(index), high = Math.min(cdf.length - 1, low + 1)
  const slopes = cellSlopes.get(cdf)
  const t = index - low
  const fractionOfMass = slopes && low < cdf.length - 1 ? Math.max(0, Math.min(1, cellCDF(t, slopes.left[low], slopes.right[low]))) : t
  return cdf[low] + (cdf[high] - cdf[low]) * fractionOfMass
}

export function polarCapProbability(j: number, m: number, halfAngleDegrees = 10): number {
  if (!(halfAngleDegrees >= 0 && halfAngleDegrees <= 90)) throw new RangeError('Polar cap half angle must be between 0° and 90°')
  const cdf = getOrientationCDF(j, m), limit = Math.cos(halfAngleDegrees * Math.PI / 180)
  return cdfAtU(cdf, -limit) + 1 - cdfAtU(cdf, limit)
}

/** Integrate theory over histogram bins to resolve rapid high-J nodes without aliasing. */
export function polarBinDensities(j: number, m: number, bins = HISTOGRAM_BINS): number[] {
  const cdf = getOrientationCDF(j, m), width = 2 / bins
  return Array.from({ length: bins }, (_, i) => (cdfAtU(cdf, -1 + (i + 1) * width) - cdfAtU(cdf, -1 + i * width)) / width)
}

export function thetaBinDensities(j: number, m: number, bins = HISTOGRAM_BINS): number[] {
  const cdf = getOrientationCDF(j, m), width = Math.PI / bins
  return Array.from({ length: bins }, (_, i) => (cdfAtU(cdf, Math.cos(i * width)) - cdfAtU(cdf, Math.cos((i + 1) * width))) / width)
}

export interface PackedCDF { cdf: Float64Array; angular: boolean; left?: Float64Array; right?: Float64Array }
export function copyOrientationCDF(j: number, m: number): PackedCDF {
  const cdf = getOrientationCDF(j, m), slopes = cellSlopes.get(cdf)
  return { cdf: cdf.slice(), angular: angularTables.has(cdf), left: slopes?.left.slice(), right: slopes?.right.slice() }
}
export function registerOrientationCDF(j: number, m: number, packed: PackedCDF) {
  if (packed.angular) angularTables.add(packed.cdf)
  if (packed.left && packed.right) cellSlopes.set(packed.cdf, { left: packed.left, right: packed.right })
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(`${j}:${Math.abs(m)}`, packed.cdf)
}

export interface SampleStatistics {
  moments?: DensityMoments
  meanMoments?: DensityMoments
  relativePhase?: number
  meanPhaseCosine?: number
  meanPhaseSine?: number
  total: number
  histogram: number[]
  currentHistogram: number[]
  azimuthHistogram: number[]
  currentAzimuthHistogram: number[]
  thetaHistogram: number[]
  currentThetaHistogram: number[]
}

/** Persistent typed buffers: resizing preserves existing orientations and allocates no geometry. */
export class OrientationEnsemble {
  readonly orientations = new Float32Array(MAX_ROTORS * 3)
  readonly azimuths = new Float64Array(MAX_ROTORS)
  private cosines = new Float64Array(MAX_ROTORS)
  readonly histogram = new Float64Array(HISTOGRAM_BINS)
  readonly currentHistogram = new Float64Array(HISTOGRAM_BINS)
  readonly azimuthHistogram = new Float64Array(HISTOGRAM_BINS)
  readonly currentAzimuthHistogram = new Float64Array(HISTOGRAM_BINS)
  readonly thetaHistogram = new Float64Array(HISTOGRAM_BINS)
  readonly currentThetaHistogram = new Float64Array(HISTOGRAM_BINS)
  private fine = Array.from({ length: 6 }, () => new Float64Array(MAX_HISTOGRAM_BINS))
  count = 0
  total = 0
  private cdf: Float64Array
  private secondCDF?: Float64Array
  private firstAmplitude?: (u: number) => number
  private secondAmplitude?: (u: number) => number
  private deltaM = 0
  private relativePhase = 0
  private statisticsPhase = 0
  private pendingStatistics = false
  private phaseCosineSum = 0
  private phaseSineSum = 0
  private moments = densityMoments(equalCoefficients)
  private statisticsMoments = this.moments
  private momentSums: DensityMoments = { first: 0, second: 0, cosine: 0, sine: 0 }
  private random: () => number

  constructor(j: number, m: number, seed: number, count = DEFAULT_ROTORS, secondary?: { j: number; m: number }) {
    this.cdf = getOrientationCDF(j, m)
    if (secondary && (secondary.j !== j || secondary.m !== m)) {
      this.secondCDF = getOrientationCDF(secondary.j, secondary.m)
      this.firstAmplitude = signedPolarAmplitude(j, m)
      this.secondAmplitude = signedPolarAmplitude(secondary.j, secondary.m)
      this.deltaM = m - secondary.m
    }
    this.random = seededRandom(seed)
    this.setCount(count)
  }

  setCount(count: number) {
    this.collectBatch()
    count = Math.max(1, Math.min(MAX_ROTORS, Math.round(count)))
    const previous = this.count
    this.count = count
    if (count > previous) this.sampleRange(previous, count)
    this.updateCurrentHistogram()
  }

  private sampleRange(start: number, end: number, recordStatistics = true) {
    for (let i = start; i < end; i++) {
      let u: number, phi: number
      if (this.secondCDF) {
        // Proposal q=p1|Y1|²+p2|Y2|²; |ψ|²≤2q, including arbitrary
        // complex interference. Endpoint proposals are exactly the eigenstates.
        for (;;) {
          u = inverseCDF(this.random() < this.moments.first ? this.cdf : this.secondCDF, this.random())
          phi = this.random() * 2 * Math.PI
          const a = this.firstAmplitude!(u), b = this.secondAmplitude!(u), sum = this.moments.first * a * a + this.moments.second * b * b
          const angle = this.deltaM * phi
          if (sum > 0 && this.random() * 2 * sum <= sum + a * b * (this.moments.cosine * Math.cos(angle) + this.moments.sine * Math.sin(angle))) break
        }
      } else { u = inverseCDF(this.cdf, this.random()); phi = this.random() * 2 * Math.PI }
      this.azimuths[i] = phi
      this.cosines[i] = u
      const radius = Math.sqrt(Math.max(0, 1 - u * u))
      this.orientations[i * 3] = radius * Math.cos(phi)
      this.orientations[i * 3 + 1] = radius * Math.sin(phi)
      this.orientations[i * 3 + 2] = u
    }
    if (recordStatistics) this.recordRange(start, end)
  }

  private recordRange(start: number, end: number) {
    for (let i = start; i < end; i++) {
      const u = this.cosines[i], phi = this.azimuths[i]
      this.histogram[Math.min(HISTOGRAM_BINS - 1, Math.floor((u + 1) / 2 * HISTOGRAM_BINS))]++
      this.azimuthHistogram[Math.min(HISTOGRAM_BINS - 1, Math.floor(phi / (2 * Math.PI) * HISTOGRAM_BINS))]++
      this.thetaHistogram[Math.min(HISTOGRAM_BINS - 1, Math.floor(Math.acos(u) / Math.PI * HISTOGRAM_BINS))]++
      this.fine[0][Math.min(MAX_HISTOGRAM_BINS - 1, Math.floor((u + 1) / 2 * MAX_HISTOGRAM_BINS))]++
      this.fine[2][Math.min(MAX_HISTOGRAM_BINS - 1, Math.floor(phi / (2 * Math.PI) * MAX_HISTOGRAM_BINS))]++
      this.fine[4][Math.min(MAX_HISTOGRAM_BINS - 1, Math.floor(Math.acos(u) / Math.PI * MAX_HISTOGRAM_BINS))]++
    }
    this.total += end - start
    this.phaseCosineSum += (end - start) * Math.cos(this.relativePhase)
    this.phaseSineSum += (end - start) * Math.sin(this.relativePhase)
    this.statisticsPhase = this.relativePhase
    this.statisticsMoments = { ...this.moments }
    for (const key of ['first', 'second', 'cosine', 'sine'] as const) this.momentSums[key] += (end - start) * this.moments[key]
  }

  private updateCurrentHistogram() {
    this.currentHistogram.fill(0)
    this.currentAzimuthHistogram.fill(0)
    this.currentThetaHistogram.fill(0)
    this.fine[1].fill(0); this.fine[3].fill(0); this.fine[5].fill(0)
    for (let i = 0; i < this.count; i++) {
      const u = this.orientations[i * 3 + 2]
      this.currentHistogram[Math.min(HISTOGRAM_BINS - 1, Math.max(0, Math.floor((u + 1) / 2 * HISTOGRAM_BINS)))]++
      this.currentAzimuthHistogram[Math.min(HISTOGRAM_BINS - 1, Math.floor(this.azimuths[i] / (2 * Math.PI) * HISTOGRAM_BINS))]++
      this.currentThetaHistogram[Math.min(HISTOGRAM_BINS - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, u))) / Math.PI * HISTOGRAM_BINS))]++
      this.fine[1][Math.min(MAX_HISTOGRAM_BINS - 1, Math.max(0, Math.floor((u + 1) / 2 * MAX_HISTOGRAM_BINS)))]++
      this.fine[3][Math.min(MAX_HISTOGRAM_BINS - 1, Math.floor(this.azimuths[i] / (2 * Math.PI) * MAX_HISTOGRAM_BINS))]++
      this.fine[5][Math.min(MAX_HISTOGRAM_BINS - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, u))) / Math.PI * MAX_HISTOGRAM_BINS))]++
    }
  }

  regenerate(relativePhase = this.relativePhase, recordStatistics = true, coefficients?: WaveCoefficients) {
    this.relativePhase = relativePhase
    this.moments = coefficients ? densityMoments(coefficients) : { first: 0.5, second: 0.5, cosine: Math.cos(relativePhase), sine: Math.sin(relativePhase) }
    this.sampleRange(0, this.count, recordStatistics)
    this.pendingStatistics = !recordStatistics
    if (recordStatistics) this.updateCurrentHistogram()
  }
  /** Record only the latest uncollected batch; drawing faster does no histogram work. */
  collectBatch(): boolean {
    if (!this.pendingStatistics) return false
    this.recordRange(0, this.count)
    this.updateCurrentHistogram()
    this.pendingStatistics = false
    return true
  }
  resetStatistics() { this.total = 0; this.phaseCosineSum = 0; this.phaseSineSum = 0; this.momentSums = { first: 0, second: 0, cosine: 0, sine: 0 }; this.histogram.fill(0); this.azimuthHistogram.fill(0); this.thetaHistogram.fill(0); this.fine[0].fill(0); this.fine[2].fill(0); this.fine[4].fill(0) }
  statistics(bins = HISTOGRAM_BINS): SampleStatistics {
    if (!HISTOGRAM_BIN_OPTIONS.includes(bins)) throw new RangeError('Unsupported histogram resolution')
    const read = (legacy: Float64Array, fine: number) => bins === HISTOGRAM_BINS ? Array.from(legacy) : rebinCounts(this.fine[fine], bins)
    return {
      moments: this.statisticsMoments,
      meanMoments: this.total ? { first: this.momentSums.first / this.total, second: this.momentSums.second / this.total, cosine: this.momentSums.cosine / this.total, sine: this.momentSums.sine / this.total } : this.statisticsMoments,
      relativePhase: this.statisticsPhase, meanPhaseCosine: this.total ? this.phaseCosineSum / this.total : Math.cos(this.statisticsPhase), meanPhaseSine: this.total ? this.phaseSineSum / this.total : Math.sin(this.statisticsPhase),
      total: this.total, histogram: read(this.histogram, 0), currentHistogram: read(this.currentHistogram, 1),
      azimuthHistogram: read(this.azimuthHistogram, 2), currentAzimuthHistogram: read(this.currentAzimuthHistogram, 3),
      thetaHistogram: read(this.thetaHistogram, 4), currentThetaHistogram: read(this.currentThetaHistogram, 5),
    }
  }
}
