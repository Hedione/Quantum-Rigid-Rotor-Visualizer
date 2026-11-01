import { describe, expect, it } from 'vitest'
import { polarAngleDensity } from './quantum'
import { cdfAtU, copyOrientationCDF, getOrientationCDF, inverseCDF, OrientationEnsemble, registerOrientationCDF, thetaBinDensities } from './sampling'

describe('solid-angle integrated probability', () => {
  it('matches analytic polar marginals including the Jacobian and azimuthal integral', () => {
    for (const theta of [0, 0.2, 0.7, Math.PI / 2, 2, Math.PI]) {
      expect(polarAngleDensity(0, 0, theta)).toBeCloseTo(Math.sin(theta) / 2, 13)
      expect(polarAngleDensity(1, 0, theta)).toBeCloseTo(1.5 * Math.cos(theta) ** 2 * Math.sin(theta), 13)
      expect(polarAngleDensity(1, 1, theta)).toBeCloseTo(0.75 * Math.sin(theta) ** 3, 13)
    }
  })
  it.each([[0, 0], [1, 0], [10, 4], [163, 0], [200, 200]])('normalizes the integrated polar-angle view for J=%i, m=%i', (j, m) => {
    const n = 32768, h = Math.PI / n
    let sum = polarAngleDensity(j, m, 0) + polarAngleDensity(j, m, Math.PI)
    for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * polarAngleDensity(j, m, i * h)
    expect(sum * h / 3).toBeCloseTo(1, 7)
    const bins = thetaBinDensities(j, m)
    expect(bins.reduce((sum, p) => sum + p * Math.PI / bins.length, 0)).toBeCloseTo(1, 12)
  })
  it('retains independent current and cumulative polar-angle histograms', () => {
    const engine = new OrientationEnsemble(163, 0, 42, 5000)
    expect(engine.statistics().thetaHistogram.reduce((a, b) => a + b, 0)).toBe(5000)
    engine.setCount(10)
    expect(engine.statistics().currentThetaHistogram.reduce((a, b) => a + b, 0)).toBe(10)
    expect(engine.statistics().thetaHistogram.reduce((a, b) => a + b, 0)).toBe(5000)
    engine.regenerate()
    expect(engine.statistics().thetaHistogram.reduce((a, b) => a + b, 0)).toBe(5010)
    engine.resetStatistics()
    expect(engine.statistics().thetaHistogram.every(value => value === 0)).toBe(true)
    expect(engine.statistics().currentThetaHistogram.reduce((a, b) => a + b, 0)).toBe(10)
  })
  it('transfers CDF data without detaching the worker cache or losing interpolation accuracy', () => {
    const original = getOrientationCDF(163, 0)
    const expected = [0.001, 0.1, 0.5, 0.9, 0.999].map(p => inverseCDF(original, p))
    const packed = copyOrientationCDF(163, 0)
    const transfer = [packed.cdf.buffer, packed.left!.buffer, packed.right!.buffer] as ArrayBuffer[]
    const moved = structuredClone(packed, { transfer })
    expect(packed.cdf.byteLength).toBe(0)
    expect(original.byteLength).toBeGreaterThan(0)
    registerOrientationCDF(163, 0, moved)
    const restored = getOrientationCDF(163, 0)
    for (const [i, p] of [0.001, 0.1, 0.5, 0.9, 0.999].entries()) {
      expect(inverseCDF(restored, p)).toBeCloseTo(expected[i], 14)
      expect(cdfAtU(restored, expected[i])).toBeCloseTo(p, 11)
    }
  })
})
