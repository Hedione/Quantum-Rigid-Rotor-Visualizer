import { describe, expect, it } from 'vitest'
import { integrateGauss } from './integration'
import { sphericalHarmonic } from './quantum'
import { OrientationEnsemble } from './sampling'
import { azimuthalOverlap, createAngularWavefunction, prepareSuperpositionDistribution } from './superposition'
import { createWavefunctionGeometry } from '../rendering/wavefunction'
import { Color } from 'three'

describe('coherent two-state rigid rotor', () => {
  it('adds complex amplitudes before squaring, with the negative-m phase convention', () => {
    const wave = createAngularWavefunction({ j: 1, m: 1, superposition: true, j2: 1, m2: -1 })
    for (const theta of [0.1, 0.7, Math.PI / 2, 2.8]) for (const phi of [0, 0.4, Math.PI / 2, 2.5]) {
      const psi = wave.evaluate(Math.cos(theta), phi)
      expect(psi.re).toBeCloseTo(0, 13)
      expect(psi.im).toBeCloseTo(-Math.sqrt(3 / (4 * Math.PI)) * Math.sin(theta) * Math.sin(phi), 13)
      expect(psi.probability).toBeCloseTo(3 / (4 * Math.PI) * Math.sin(theta) ** 2 * Math.sin(phi) ** 2, 13)
    }
  })
  it.each([[1, 1, 1, -1], [2, 2, 2, -2], [3, 3, 3, -3], [1, 0, 2, 1], [2, 0, 4, 0], [2, 1, 2, 1], [50, 50, 50, -50]])('normalizes the full spherical density for (%i,%i)+(%i,%i)', (j, m, j2, m2) => {
    const state = { j, m, superposition: true, j2, m2 }, wave = createAngularWavefunction(state)
    const integral = integrateGauss(u => {
      let sum = 0
      for (let i = 0; i < 256; i++) sum += wave.evaluate(u, i * 2 * Math.PI / 256).probability
      return sum * 2 * Math.PI / 256
    }, -1, 1)
    expect(integral).toBeCloseTo(1, 10)
    const theory = prepareSuperpositionDistribution(state)
    expect(theory.polar.reduce((sum, p) => sum + p * 2 / 40, 0)).toBeCloseTo(1, 10)
    expect(theory.theta.reduce((sum, p) => sum + p * Math.PI / 40, 0)).toBeCloseTo(1, 10)
    expect(theory.azimuth.every(value => value >= 0 && Number.isFinite(value))).toBe(true)
  })
  it('reduces duplicate states to one normalized eigenstate and preserves its seeded samples', () => {
    const wave = createAngularWavefunction({ j: 2, m: -1, superposition: true, j2: 2, m2: -1 })
    const actual = wave.evaluate(0.3, 1.1), expected = sphericalHarmonic(2, -1, Math.acos(0.3), 1.1)
    expect(actual.re).toBeCloseTo(expected.re, 14)
    expect(actual.im).toBeCloseTo(expected.im, 14)
    const single = new OrientationEnsemble(2, -1, 42, 100)
    const duplicate = new OrientationEnsemble(2, -1, 42, 100, { j: 2, m: -1 })
    expect(duplicate.orientations).toEqual(single.orientations)
  })
  it('integrates the azimuthal marginal, including parity cancellation and unequal J interference', () => {
    expect(azimuthalOverlap({ j: 1, m: 0, superposition: true, j2: 1, m2: 1 })).toBe(0)
    expect(azimuthalOverlap({ j: 1, m: 0, superposition: true, j2: 2, m2: 1 })).toBeCloseTo(-3 * Math.sqrt(10) / 64, 11)
    const wave = createAngularWavefunction({ j: 2, m: 0, superposition: true, j2: 4, m2: 0 })
    const u = 0.7, expected = (sphericalHarmonic(2, 0, Math.acos(u), 0).re + sphericalHarmonic(4, 0, Math.acos(u), 0).re) ** 2 / 2 * 2 * Math.PI
    expect(wave.polarDensity(u)).toBeCloseTo(expected, 13)
    expect(prepareSuperpositionDistribution({ j: 2, m: 0, superposition: true, j2: 4, m2: 0 }).azimuth.every(value => Math.abs(value - 1 / (2 * Math.PI)) < 1e-13)).toBe(true)
  })
  it.each([[1, -0.5], [2, 0.5], [3, -0.5]])('samples the %i,±m interference fringes instead of an incoherent mixture', (j, expectedMoment) => {
    const engine = new OrientationEnsemble(j, j, 482, 5000, { j, m: -j })
    let moment = 0, squaredY = 0, total = 0
    for (let batch = 0; batch < 16; batch++) {
      if (batch) engine.regenerate()
      for (let i = 0; i < engine.count; i++) { moment += Math.cos(2 * j * engine.azimuths[i]); squaredY += engine.orientations[i * 3 + 1] ** 2 }
      total += engine.count
    }
    expect(Math.abs(moment / total - expectedMoment)).toBeLessThan(0.012)
    if (j === 1) expect(Math.abs(squaredY / total - 0.6)).toBeLessThan(0.012)
  })
  it('retains u/phi correlation even when the integrated azimuthal marginal is uniform', () => {
    const engine = new OrientationEnsemble(1, 0, 912, 5000, { j: 1, m: 1 })
    let cross = 0, azimuth = 0, total = 0
    for (let batch = 0; batch < 16; batch++) {
      if (batch) engine.regenerate()
      for (let i = 0; i < engine.count; i++) { cross += engine.orientations[i * 3] * engine.orientations[i * 3 + 2]; azimuth += Math.cos(engine.azimuths[i]) }
      total += engine.count
    }
    expect(Math.abs(cross / total + 1 / (5 * Math.SQRT2))).toBeLessThan(0.01)
    expect(Math.abs(azimuth / total)).toBeLessThan(0.012)
  })
  it('preserves lab-frame interference and the sin(theta) Jacobian in the joint radial display', () => {
    const state = { j: 1, m: 1, superposition: true, j2: 1, m2: -1 }
    const surface = createWavefunctionGeometry({ ...state, surfaceQuantity: 'probability' })
    const position = surface.getAttribute('position'), row = 64, width = 192
    const radius = (col: number) => Math.hypot(...[0, 1, 2].map(axis => position.array[(row * (width + 1) + col) * 3 + axis]))
    expect(radius(0)).toBeLessThan(1e-10)
    expect(radius(48)).toBeCloseTo(1.9, 6)
    const real = createWavefunctionGeometry({ ...state, surfaceQuantity: 'real' })
    expect(real.boundingSphere!.radius).toBe(0)
    const joint = createWavefunctionGeometry({ ...state, surfaceQuantity: 'jointProbability' })
    const p = joint.getAttribute('position')
    const r0 = Math.hypot(p.getX(row * 193), p.getY(row * 193), p.getZ(row * 193))
    const r1 = Math.hypot(p.getX(row * 193 + 48), p.getY(row * 193 + 48), p.getZ(row * 193 + 48))
    expect(r0).toBeLessThan(1e-10)
    expect(r1).toBeCloseTo(1.9, 6)
    const tilted = 32 * 193 + 48 // theta=pi/4, phi=3pi/2.
    const tiltedRadius = Math.hypot(p.getX(tilted), p.getY(tilted), p.getZ(tilted))
    // |psi|² is proportional to sin²(theta) here; the joint density is sin³(theta).
    expect(tiltedRadius / r1).toBeCloseTo(Math.SQRT1_2 ** 3, 6)
    surface.dispose(); real.dispose(); joint.dispose()
  })
  it('uses the lab-frame sign of the imaginary component for surface colors', () => {
    const surface = createWavefunctionGeometry({ j: 1, m: 1, superposition: true, j2: 1, m2: -1, surfaceQuantity: 'imaginary' })
    const positions = surface.getAttribute('position'), colors = surface.getAttribute('color')
    for (const col of [48, 144]) {
      const i = 64 * 193 + col
      const imaginarySign = -Math.sign(positions.getY(i)) // ψ ∝ −i y.
      const expected = new Color(imaginarySign > 0 ? '#8faaf0' : '#f0b887').toArray()
      expect(colors.getX(i)).toBeCloseTo(expected[0], 6)
      expect(colors.getY(i)).toBeCloseTo(expected[1], 6)
      expect(colors.getZ(i)).toBeCloseTo(expected[2], 6)
    }
    surface.dispose()
  })
})
