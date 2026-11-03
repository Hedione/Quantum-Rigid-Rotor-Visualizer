import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defaultSettings } from '../types'
import { integrateGauss } from './integration'
import { getPolarAmplitude, MAX_J, polarAngleDensity, polarDensity, sphericalHarmonic } from './quantum'
import { QuantumTimeline } from './evolution'
import { transitionTimeScale } from './transition'
import { createAngularWavefunction, densityMoments, distributionAtMoments, distributionAtPhase, normalizeCoefficients, prepareSuperpositionDistribution, type CoherentState, type WaveCoefficients } from './superposition'
import { cdfAtU, getOrientationCDF, OrientationEnsemble, polarBinDensities, thetaBinDensities } from './sampling'
import { HISTOGRAM_BIN_OPTIONS, MAX_HISTOGRAM_BINS, rebinDensities } from './histograms'

type ErrorSummary = { cases: number; maximumError: number; worstCase: string }
const report: Record<string, ErrorSummary> = {}
function check(name: string, value: number, label: string, tolerance = 1e-10) {
  const summary = report[name] ??= { cases: 0, maximumError: 0, worstCase: '' }
  summary.cases++
  const error = Math.abs(value - 1)
  if (error > summary.maximumError) { summary.maximumError = error; summary.worstCase = label }
  if (!Number.isFinite(value) || error > tolerance) throw new Error(`${name}: ${label}: integral=${value}, error=${error}, tolerance=${tolerance}`)
}
afterAll(() => {
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/normalization-audit.json', JSON.stringify(report, null, 2) + '\n')
  console.info('Normalization audit:', JSON.stringify(report))
})

/** Test both coordinate measures directly, without renormalizing the result.
 * Azimuthal trapezoidal quadrature resolves every Fourier order in psi².
 * Separate Gaussian rules in u and theta expose missing/doubled Jacobians. */
function integrateFields(state: CoherentState, firstPhase = 0, secondPhase = 0, coefficients?: WaveCoefficients) {
  const wave = createAngularWavefunction(state)
  const j = Math.max(state.j, state.superposition || state.coherentTransition ? state.j2 ?? 2 : 0)
  const order = Math.max(Math.abs(state.m), state.superposition || state.coherentTransition ? Math.abs(state.m2 ?? 1) : 0)
  const azimuths = Math.max(8, 4 * order + 1), dphi = 2 * Math.PI / azimuths
  const marginal = (u: number, field: 'probability' | 'magnitude' | 're' | 'im') => {
    let total = 0
    for (let k = 0; k < azimuths; k++) {
      const value = wave.evaluate(u, k * dphi, firstPhase, secondPhase, coefficients)[field]
      if (!Number.isFinite(value) || (field === 'probability' && value < 0)) throw new Error('Invalid angular field')
      total += field === 'probability' ? value : value * value
    }
    return total * dphi
  }
  const degree = Math.max(24, j + 1)
  const probability = integrateGauss(u => marginal(u, 'probability'), -1, 1, degree)
  const joint = integrateGauss(theta => marginal(Math.cos(theta), 'probability') * Math.sin(theta), 0, Math.PI, Math.max(64, 3 * j + 32))
  const magnitudeSquared = integrateGauss(u => marginal(u, 'magnitude'), -1, 1, degree)
  const realSquared = integrateGauss(u => marginal(u, 're'), -1, 1, degree)
  const imaginarySquared = integrateGauss(u => marginal(u, 'im'), -1, 1, degree)
  return { probability, joint, magnitudeSquared, componentsSquared: realSquared + imaginarySquared }
}

describe('normalization throughout every quantum mode', () => {
  it('integrates every supported eigenstate, including every signed m for J=0–200', () => {
    for (let j = 0; j <= MAX_J; j++) for (let m = -j; m <= j; m++) {
      const label = `J=${j}, m=${m}`, wave = createAngularWavefunction({ j, m })
      check('eigenstate probability / dΩ', 2 * Math.PI * integrateGauss(u => sphericalHarmonic(j, m, Math.acos(u), 0.731).probability, -1, 1, 256), label)
      check('eigenstate joint / dθdφ', 2 * Math.PI * integrateGauss(theta => wave.evaluate(Math.cos(theta), 0.731).probability * Math.sin(theta), 0, Math.PI, 512), label)
      for (const theta of [0.31, 1.12, 2.41]) {
        const value = sphericalHarmonic(j, m, theta, 0.731)
        expect(value.magnitude ** 2).toBeCloseTo(value.probability, 11)
        expect(value.re ** 2 + value.im ** 2).toBeCloseTo(value.probability, 11)
      }
    }
  }, 120000)

  it('checks the full basis Gram matrix, establishing normalization for arbitrary phases and weights at all times', () => {
    // Reconstruct weighted quadrature samples without accessing the production rule.
    // A delta probe extracts each integration node/weight in the actual integrator.
    const nodes: number[] = [], weights: number[] = []
    integrateGauss(u => { nodes.push(u); return 0 }, -1, 1, 256)
    for (const node of nodes) weights.push(integrateGauss(u => u === node ? 1 : 0, -1, 1, 256))
    let maximumOverlap = 0, pairs = 0
    for (let m = 0; m <= MAX_J; m++) {
      const basis = Array.from({ length: MAX_J - m + 1 }, (_, k) => {
        const a = getPolarAmplitude(k + m, m)
        return Float64Array.from(nodes, (u, i) => a(u) * Math.sqrt(2 * Math.PI * weights[i]))
      })
      for (let i = 0; i < basis.length; i++) for (let k = 0; k < i; k++) {
        let overlap = 0
        for (let n = 0; n < nodes.length; n++) overlap += basis[i][n] * basis[k][n]
        maximumOverlap = Math.max(maximumOverlap, Math.abs(overlap)); pairs++
      }
    }
    // For m != m', orthogonality follows from the azimuthal Fourier integral.
    let maximumFourierOverlap = 0
    const nphi = 2 * MAX_J + 1
    for (let order = 1; order <= 2 * MAX_J; order++) {
      let re = 0, im = 0
      for (let k = 0; k < nphi; k++) { re += Math.cos(2 * Math.PI * order * k / nphi); im += Math.sin(2 * Math.PI * order * k / nphi) }
      maximumFourierOverlap = Math.max(maximumFourierOverlap, Math.hypot(re, im) / nphi)
    }
    report['basis off-diagonal Gram overlaps'] = { cases: pairs, maximumError: maximumOverlap, worstCase: 'all J pairs for every |m|≤200' }
    report['azimuthal orthogonality'] = { cases: 2 * MAX_J, maximumError: maximumFourierOverlap, worstCase: 'all nonzero Fourier orders through 400' }
    expect(maximumOverlap).toBeLessThan(1e-10)
    expect(maximumFourierOverlap).toBeLessThan(1e-10)
  }, 120000)

  it('checks both densities and all amplitude views at 1,001 times across a complete pulse for four drive phases', () => {
    const state = { ...defaultSettings, coherentTransition: true, j: 1, m: 1, j2: 2, m2: 0, transitionPlaying: true }
    const duration = Math.PI / (state.rabiFrequency * 1e12)
    for (const drivePhase of [0, 0.73, Math.PI / 2, Math.PI]) {
      const s = { ...state, drivePhase }, clock = new QuantumTimeline()
      clock.configure(s, 0)
      for (let i = 0; i <= 1000; i++) {
        const frame = clock.read(duration / transitionTimeScale(s) * 1000 * i / 1000)
        const values = integrateFields(s, 0, 0, frame.coefficients)
        for (const [name, value] of Object.entries(values)) check(`full pulse ${name}`, value, `progress=${i / 1000}, drivePhase=${drivePhase}`)
      }
    }
  }, 120000)

  const pairs = [
    [0, 0, 1, 0], [1, 0, 0, 0], [0, 0, 1, 1], [1, -1, 2, 0],
    [1, 1, 1, -1], [2, 2, 2, -2], [2, -1, 2, -1], [10, 0, 9, 0],
    [50, 0, 49, 0], [50, 50, 49, 49], [50, 50, 50, -50], [200, 0, 199, 0], [200, -200, 199, -199],
  ]
  it.each(pairs)('checks stationary, free-evolving and arbitrary complex states (%s,%s)+(%s,%s)', (j, m, j2, m2) => {
    const s = { ...defaultSettings, superposition: true, j, m, j2, m2 }, clock = new QuantumTimeline()
    clock.configure(s, 0)
    for (const now of [0, 1200, 1e6]) {
      const frame = clock.read(now), label = `(${j},${m})+(${j2},${m2}), t=${frame.time}`
      // Exercise both the legacy phase arguments and the new complex-coefficient path.
      const legacy = integrateFields(s, frame.firstPhase, frame.secondPhase)
      const complex = integrateFields(s, 0, 0, frame.coefficients)
      for (const [name, value] of Object.entries(legacy)) check(`free evolution ${name}`, value, label)
      for (const [name, value] of Object.entries(complex)) check(`complex evolution ${name}`, value, label)
    }
    const c = normalizeCoefficients({ first: { re: 0.2, im: 0.7 }, second: { re: -0.6, im: 0.1 } }, j === j2 && m === m2)
    for (const [name, value] of Object.entries(integrateFields(s, 0, 0, c))) check(`arbitrary weights ${name}`, value, `(${j},${m})+(${j2},${m2})`)
  }, 120000)

  it('normalizes every marginal and histogram resolution for current and accumulated states', () => {
    for (const [j, m, j2, m2] of pairs) {
      const state = { j, m, superposition: true, j2, m2 }, theory = prepareSuperpositionDistribution(state, MAX_HISTOGRAM_BINS)
      const duplicate = j === j2 && m === m2
      const mean = { first: 0, second: 0, cosine: 0, sine: 0 }
      for (let i = 0; i <= 100; i++) {
        const c = normalizeCoefficients({ first: { re: Math.cos(i * Math.PI / 200), im: 0 }, second: { re: Math.sin(i * Math.PI / 200) * Math.cos(i * 0.13), im: Math.sin(i * Math.PI / 200) * Math.sin(i * 0.13) } }, duplicate)
        const moments = densityMoments(c)
        // Duplicate basis functions are handled by their fixed normalized theory.
        for (const key of ['first', 'second', 'cosine', 'sine'] as const) mean[key] += moments[key] / 101
        const current = distributionAtMoments(theory, moments)
        const phaseOnly = distributionAtPhase(theory, Math.cos(i * 0.13), Math.sin(i * 0.13))
        for (const distribution of [current, phaseOnly]) for (const bins of HISTOGRAM_BIN_OPTIONS) {
          const label = `${j},${m};${j2},${m2}; frame=${i}; bins=${bins}`
          check('polar diagnostic', rebinDensities(distribution.polar, bins).reduce((a, b) => a + b * 2 / bins, 0), label)
          check('theta diagnostic', rebinDensities(distribution.theta, bins).reduce((a, b) => a + b * Math.PI / bins, 0), label)
          check('azimuth diagnostic', rebinDensities(distribution.azimuthBins!, bins).reduce((a, b) => a + b * 2 * Math.PI / bins, 0), label)
          expect([...distribution.polar, ...distribution.theta, ...distribution.azimuthBins!].every(p => p >= 0 && Number.isFinite(p))).toBe(true)
        }
      }
      const cumulative = distributionAtMoments(theory, mean)
      check('cumulative polar diagnostic', cumulative.polar.reduce((a, b) => a + b * 2 / MAX_HISTOGRAM_BINS, 0), `${j},${m};${j2},${m2}`)
      check('cumulative theta diagnostic', cumulative.theta.reduce((a, b) => a + b * Math.PI / MAX_HISTOGRAM_BINS, 0), `${j},${m};${j2},${m2}`)
      check('cumulative azimuth diagnostic', cumulative.azimuthBins!.reduce((a, b) => a + b * 2 * Math.PI / MAX_HISTOGRAM_BINS, 0), `${j},${m};${j2},${m2}`)
    }
  }, 120000)

  it('normalizes eigenstate marginals, sampling CDFs and actual current/cumulative sample histograms', () => {
    for (const [j, m] of [[0, 0], [1, 1], [10, -10], [50, 0], [50, -49], [200, 0], [200, -200]]) {
      const cdf = getOrientationCDF(j, m), label = `J=${j},m=${m}`
      check('CDF mass', cdfAtU(cdf, 1) - cdfAtU(cdf, -1), label)
      expect(Array.from(cdf).every((p, i) => Number.isFinite(p) && p >= 0 && p <= 1 && (!i || p >= cdf[i - 1]))).toBe(true)
      check('polarDensity function', integrateGauss(u => polarDensity(j, m, u), -1, 1, 256), label)
      check('polarAngleDensity function', integrateGauss(theta => polarAngleDensity(j, m, theta), 0, Math.PI, 512), label)
      for (const bins of HISTOGRAM_BIN_OPTIONS) {
        check('polar CDF bins', polarBinDensities(j, m, bins).reduce((a, b) => a + b * 2 / bins, 0), label)
        check('theta CDF bins', thetaBinDensities(j, m, bins).reduce((a, b) => a + b * Math.PI / bins, 0), label)
      }
    }
    const s = { ...defaultSettings, coherentTransition: true, superposition: true, j: 1, m: 1, j2: 2, m2: 0, transitionPlaying: true }
    const clock = new QuantumTimeline(); clock.configure(s, 0)
    const engine = new OrientationEnsemble(1, 1, 321, 1000, { j: 2, m: 0 }); engine.resetStatistics()
    for (let i = 0; i <= 100; i++) {
      const frame = clock.read(Math.PI / (s.rabiFrequency * 1e12) / transitionTimeScale(s) * 1000 * i / 100)
      engine.regenerate(frame.relativePhase, true, frame.coefficients)
      for (const bins of HISTOGRAM_BIN_OPTIONS) {
        const stats = engine.statistics(bins)
        for (const counts of [stats.histogram, stats.azimuthHistogram, stats.thetaHistogram]) check('cumulative sampled mass', counts.reduce((a, b) => a + b / stats.total, 0), `frame=${i}, bins=${bins}`)
        for (const counts of [stats.currentHistogram, stats.currentAzimuthHistogram, stats.currentThetaHistogram]) check('current sampled mass', counts.reduce((a, b) => a + b / engine.count, 0), `frame=${i}, bins=${bins}`)
      }
    }
  }, 120000)
})
