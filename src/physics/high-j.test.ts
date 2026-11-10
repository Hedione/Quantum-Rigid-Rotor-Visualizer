import { describe, expect, it } from 'vitest'
import { getPolarAmplitude, polarDensity, sphericalHarmonic } from './quantum'
import { cdfAtU, getOrientationCDF, inverseCDF, OrientationEnsemble, polarBinDensities, polarCapProbability } from './sampling'

// Independent Gauss–Legendre quadrature integrates polynomial densities through degree 400.
const quadrature = (() => {
  const nodes: { x: number; w: number }[] = [], n = 256
  for (let i = 1; i <= n / 2; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), derivative = 0
    for (let iteration = 0; iteration < 20; iteration++) {
      let p0 = 1, p1 = x
      for (let l = 2; l <= n; l++) { const p = ((2 * l - 1) * x * p1 - (l - 1) * p0) / l; p0 = p1; p1 = p }
      derivative = n * (x * p1 - p0) / (x * x - 1)
      const next = x - p1 / derivative
      if (Math.abs(next - x) < 1e-15) { x = next; break }
      x = next
    }
    const w = 2 / ((1 - x * x) * derivative * derivative)
    nodes.push({ x, w }, { x: -x, w })
  }
  return nodes
})()
const integrate = (f: (x: number) => number, min = -1, max = 1) => quadrature.reduce((sum, { x, w }) => sum + w * f((min + max) / 2 + x * (max - min) / 2) * (max - min) / 2, 0)

describe('high-J numerical stability and correspondence', () => {
  it('audits J=163, m=0 against an independent ordinary-Legendre calculation', () => {
    const j = 163
    const referenceDensity = (u: number) => {
      let previous = 1, current = u
      for (let l = 2; l <= j; l++) {
        const next = ((2 * l - 1) * u * current - (l - 1) * previous) / l
        previous = current; current = next
      }
      return (2 * j + 1) / 2 * current * current
    }
    const angles = [5, 10, 15, 30, 45]
    const caps = angles.map(angle => ({ angle, threshold: Math.cos(angle * Math.PI / 180), expected: 2 * integrate(referenceDensity, Math.cos(angle * Math.PI / 180), 1), sampled: 0 }))
    const cdf = getOrientationCDF(j, 0)
    let maximumCDFError = 0
    for (let i = 0; i <= 100; i++) {
      const u = -1 + 2 * i / 100
      maximumCDFError = Math.max(maximumCDFError, Math.abs(cdfAtU(cdf, u) - integrate(referenceDensity, -1, u)))
    }
    expect(maximumCDFError).toBeLessThan(0.000000001)
    for (const cap of caps) expect(polarCapProbability(j, 0, cap.angle)).toBeCloseTo(cap.expected, 8)
    const engine = new OrientationEnsemble(j, 0, 42, 5000)
    let samples = 0, squared = 0
    for (let batch = 0; batch < 40; batch++) {
      if (batch) engine.regenerate()
      for (let i = 0; i < engine.count; i++) {
        const u = engine.orientations[i * 3 + 2]
        squared += u * u
        for (const cap of caps) if (Math.abs(u) >= cap.threshold) cap.sampled++
      }
      samples += engine.count
    }
    const expectedMoment = (j + 1) ** 2 / ((2 * j + 1) * (2 * j + 3)) + j * j / ((2 * j - 1) * (2 * j + 1))
    expect(integrate(u => u * u * referenceDensity(u))).toBeCloseTo(expectedMoment, 12)
    expect(Math.abs(squared / samples - expectedMoment)).toBeLessThan(0.003)
    for (const cap of caps) expect(Math.abs(cap.sampled / samples - cap.expected)).toBeLessThan(0.004)
    console.info('J=163, m=0 independent audit', JSON.stringify({ samples, maximumCDFError, expectedMoment, sampledMoment: squared / samples, caps: caps.map(cap => ({ halfAngleDegrees: cap.angle, expected: cap.expected, sampled: cap.sampled / samples })) }))
  })
  it.each([[25, 0], [50, 0], [100, 1], [101, 101], [150, 0], [150, 75], [150, 149], [150, 150], [200, 0], [200, 100], [200, 198], [200, 199], [200, 200]])('normalizes J=%i, m=%i without factorial overflow', (j, m) => {
    expect(integrate(u => polarDensity(j, m, u))).toBeCloseTo(1, 10)
    for (const u of [-1, -0.9999, -0.8, -0.1, 0, 0.1, 0.8, 0.9999, 1]) {
      const h = sphericalHarmonic(j, m, Math.acos(u), 0.79)
      expect(Object.values(h).every(Number.isFinite)).toBe(true)
      expect(h.probability).toBe(sphericalHarmonic(j, -m, Math.acos(u), 0.79).probability)
    }
  })
  it('preserves orthogonality between high-J states of the same order', () => {
    const a = getPolarAmplitude(150, 75), b = getPolarAmplitude(149, 75)
    expect(integrate(u => 2 * Math.PI * a(u) * b(u))).toBeCloseTo(0, 11)
  })
  it.each([[150, 0], [150, 75], [200, 0], [200, 199], [200, 200]])('resolves the high-J CDF and histogram probabilities for J=%i, m=%i', (j, m) => {
    const cdf = getOrientationCDF(j, m)
    for (const u of [-0.9999, -0.7, -0.01, 0, 0.01, 0.7, 0.9999]) {
      expect(Math.abs(cdfAtU(cdf, u) - integrate(x => polarDensity(j, m, x), -1, u))).toBeLessThan(0.00003)
    }
    for (const p of [0, 0.001, 0.1, 0.5, 0.9, 0.999, 1]) expect(cdfAtU(cdf, inverseCDF(cdf, p))).toBeCloseTo(p, 10)
    const bins = polarBinDensities(j, m)
    expect(bins.every(p => Number.isFinite(p) && p >= 0)).toBe(true)
    expect(bins.reduce((sum, p) => sum + p * 2 / bins.length, 0)).toBeCloseTo(1, 12)
  })
  it('shows the stretched-state ensemble approaching the classical plane as J increases', () => {
    let previousVariance = Infinity
    for (const j of [10, 50, 150, 200]) {
      const expected = 1 / (2 * j + 3)
      expect(integrate(u => u * u * polarDensity(j, j, u))).toBeCloseTo(expected, 12)
      const engine = new OrientationEnsemble(j, j, 553, 5000)
      let squared = 0, samples = 0
      for (let batch = 0; batch < 12; batch++) {
        if (batch) engine.regenerate()
        for (let i = 0; i < engine.count; i++) squared += engine.orientations[i * 3 + 2] ** 2
        samples += engine.count
      }
      const variance = squared / samples
      expect(Math.abs(variance / expected - 1)).toBeLessThan(0.035)
      expect(variance).toBeLessThan(previousVariance)
      previousVariance = variance
    }
  })
})
