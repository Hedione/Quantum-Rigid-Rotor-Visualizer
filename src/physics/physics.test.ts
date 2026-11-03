import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { adjacentState, associatedLegendre, HBAR, MAX_J, molecularParameters, polarDensity, quantumQuantities, sphericalHarmonic } from './quantum'
import { getOrientationCDF, inverseCDF, MAX_ROTORS, OrientationEnsemble, seededRandom } from './sampling'
import { angularMomentumAxis, atomPositions, ClassicalClock, DISPLAY_TIME_SCALE, rotorOrientation, type Vec3 } from './classical'
import { updateEnsembleMeshes } from './instancing'
import { defaultSettings } from '../types'

function integrate(f: (x: number) => number, n = 16384) {
  let sum = f(-1) + f(1)
  const h = 2 / n
  for (let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * f(-1 + i * h)
  return sum * h / 3
}
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0)

describe('normalized spherical harmonics', () => {
  it('uses the Condon–Shortley phase and known analytic harmonics', () => {
    expect(associatedLegendre(1, 1, 0)).toBe(-1)
    expect(sphericalHarmonic(0, 0, 1, 2).re).toBeCloseTo(1 / Math.sqrt(4 * Math.PI), 14)
    expect(sphericalHarmonic(1, 0, 0, 0).re).toBeCloseTo(Math.sqrt(3 / (4 * Math.PI)), 14)
    expect(sphericalHarmonic(1, 1, Math.PI / 2, 0).re).toBeCloseTo(-Math.sqrt(3 / (8 * Math.PI)), 14)
    expect(sphericalHarmonic(1, -1, Math.PI / 2, 0).re).toBeCloseTo(Math.sqrt(3 / (8 * Math.PI)), 14)
  })
  it('integrates to one over solid angle for all 121 low-J states', () => {
    for (let j = 0; j <= 10; j++) for (let m = -j; m <= j; m++) {
      const integral = integrate(u => 2 * Math.PI * sphericalHarmonic(j, m, Math.acos(u), 0.631).probability)
      expect(integral, `J=${j}, m=${m}`).toBeCloseTo(1, 7)
    }
  })
  it('has the conjugate symmetry and equal probabilities for positive/negative m', () => {
    for (let j = 1; j <= 10; j++) for (let m = 1; m <= j; m++) {
      const positive = sphericalHarmonic(j, m, 0.9, 1.3)
      const negative = sphericalHarmonic(j, -m, 0.9, 1.3)
      expect(negative.re).toBeCloseTo((-1) ** m * positive.re, 14)
      expect(negative.im).toBeCloseTo(-((-1) ** m) * positive.im, 14)
      expect(negative.probability).toBe(positive.probability)
      expect(getOrientationCDF(j, -m)).toBe(getOrientationCDF(j, m))
    }
  })
  it('reproduces the analytic polar densities for J=0 and J=1', () => {
    for (const u of [-1, -0.8, -0.1, 0, 0.3, 0.9, 1]) {
      expect(polarDensity(0, 0, u)).toBeCloseTo(0.5, 14)
      expect(polarDensity(1, 0, u)).toBeCloseTo(1.5 * u * u, 14)
      expect(polarDensity(1, 1, u)).toBeCloseTo(0.75 * (1 - u * u), 14)
    }
  })
  it('rejects invalid quantum states and cycles through valid adjacent states', () => {
    expect(() => sphericalHarmonic(MAX_J + 1, 0, 0, 0)).toThrow()
    expect(() => sphericalHarmonic(1, 2, 0, 0)).toThrow()
    expect(adjacentState(1, 1, 1)).toEqual([2, -2])
    expect(adjacentState(0, 0, -1)).toEqual([MAX_J, MAX_J])
    expect(adjacentState(0, 0, -1, 10)).toEqual([10, 10])
  })
})

describe('Monte Carlo sampling over solid angle', () => {
  it.each([[0, 0, 1 / 3, 1 / 5], [1, 0, 3 / 5, 3 / 7], [1, 1, 1 / 5, 3 / 35], [1, -1, 1 / 5, 3 / 35]])('J=%i, m=%i has the expected solid-angle distribution', (j, m, expectedSecond, expectedFourth) => {
    const cdf = getOrientationCDF(j, m), random = seededRandom(1234)
    const n = 60000
    let first = 0, second = 0, fourth = 0, cosPhi = 0, sinPhi = 0
    for (let i = 0; i < n; i++) {
      const u = inverseCDF(cdf, random()), phi = random() * 2 * Math.PI
      first += u; second += u ** 2; fourth += u ** 4; cosPhi += Math.cos(phi); sinPhi += Math.sin(phi)
    }
    expect(Math.abs(first / n)).toBeLessThan(0.008)
    expect(Math.abs(second / n - expectedSecond)).toBeLessThan(0.006)
    expect(Math.abs(fourth / n - expectedFourth)).toBeLessThan(0.006)
    expect(Math.abs(cosPhi / n)).toBeLessThan(0.01)
    expect(Math.abs(sinPhi / n)).toBeLessThan(0.01)
  })
  it('matches the high-J CDF against independent integration, including at nodes', () => {
    for (const m of [0, 3, 7, 10]) {
      const cdf = getOrientationCDF(10, m)
      expect(cdf[0]).toBe(0)
      expect(cdf.at(-1)).toBe(1)
      for (const u of [-0.95, -0.5, 0, 0.7, 0.97]) {
        const n = 8192, step = (u + 1) / n
        let sum = 0
        for (let k = 0; k < n; k++) sum += polarDensity(10, m, -1 + (k + 0.5) * step) * step
        const index = Math.round((u + 1) / 2 * (cdf.length - 1))
        expect(Math.abs(cdf[index] - sum)).toBeLessThan(0.002)
      }
    }
  })
  it('is reproducible, adds independent samples on growth and preserves survivors on shrink', () => {
    const a = new OrientationEnsemble(2, 1, 42, 100), b = new OrientationEnsemble(2, 1, 42, 100)
    expect(a.orientations).toEqual(b.orientations)
    const prefix = a.orientations.slice(0, 30)
    a.setCount(10)
    expect(a.total).toBe(100)
    a.setCount(2000)
    expect(a.orientations.slice(0, 30)).toEqual(prefix)
    expect(a.total).toBe(2090)
    expect(a.currentHistogram.reduce((x, y) => x + y, 0)).toBe(2000)
    expect(a.histogram.reduce((x, y) => x + y, 0)).toBe(a.total)
    a.regenerate()
    expect(a.total).toBe(4090)
    expect(a.orientations.slice(0, 30)).not.toEqual(prefix)
    a.resetStatistics()
    expect(a.total).toBe(0)
    expect(a.currentHistogram.reduce((x, y) => x + y, 0)).toBe(2000)
  })
  it('updates all three live InstancedMesh draw counts from 1 to 10000 and back', () => {
    const engine = new OrientationEnsemble(1, 0, 42)
    const geometry = new THREE.SphereGeometry(), material = new THREE.MeshBasicMaterial()
    const make = () => new THREE.InstancedMesh(geometry, material, MAX_ROTORS)
    const meshes = { rods: make(), atomsA: make(), atomsB: make() }
    const object = new THREE.Object3D(), vector = new THREE.Vector3()
    for (const count of [1, 10, 100, 500, 2500, 5000, 10000, 17, 1]) {
      engine.setCount(count)
      updateEnsembleMeshes(engine, meshes, 1.65, object, vector)
      for (const mesh of Object.values(meshes)) expect(mesh.count).toBe(count)
      const a = new THREE.Matrix4(), b = new THREE.Matrix4()
      meshes.atomsA.getMatrixAt(count - 1, a)
      meshes.atomsB.getMatrixAt(count - 1, b)
      const pa = new THREE.Vector3().setFromMatrixPosition(a), pb = new THREE.Vector3().setFromMatrixPosition(b)
      expect(pa.clone().add(pb).length()).toBeLessThan(1e-7)
      expect(pa.distanceTo(pb)).toBeCloseTo(3.3, 6)
    }
    geometry.dispose(); material.dispose()
    for (const mesh of Object.values(meshes)) mesh.dispose()
  })
  it('bins the sampled azimuths correctly and keeps current/cumulative charts independent', () => {
    const engine = new OrientationEnsemble(1, 0, 981, MAX_ROTORS)
    const expected = new Float64Array(40)
    for (let i = 0; i < engine.count; i++) expected[Math.floor(engine.azimuths[i] / (2 * Math.PI) * 40)]++
    expect(engine.currentAzimuthHistogram).toEqual(expected)
    expect(engine.azimuthHistogram).toEqual(expected)
    engine.setCount(1)
    expect(engine.currentAzimuthHistogram.reduce((a, b) => a + b, 0)).toBe(1)
    expect(engine.azimuthHistogram.reduce((a, b) => a + b, 0)).toBe(MAX_ROTORS)
    engine.regenerate()
    expect(engine.total).toBe(MAX_ROTORS + 1)
    expect(engine.azimuthHistogram.reduce((a, b) => a + b, 0)).toBe(engine.total)
    engine.resetStatistics()
    expect(engine.statistics().azimuthHistogram.every(value => value === 0)).toBe(true)
    expect(engine.currentAzimuthHistogram.reduce((a, b) => a + b, 0)).toBe(1)
  })
  it.each([[0, 0], [1, 0], [1, 1], [10, -7]])('has a uniform azimuth histogram for J=%i, m=%i', (j, m) => {
    const engine = new OrientationEnsemble(j, m, 5523, MAX_ROTORS)
    for (let i = 0; i < 5; i++) engine.regenerate()
    const expected = engine.total / engine.azimuthHistogram.length
    const chiSquared = engine.azimuthHistogram.reduce((sum, value) => sum + (value - expected) ** 2 / expected, 0)
    expect(chiSquared).toBeLessThan(85)
    const binWidth = 2 * Math.PI / engine.azimuthHistogram.length
    const integral = engine.azimuthHistogram.reduce((sum, n) => sum + n / engine.total / binWidth * binWidth, 0)
    expect(integral).toBeCloseTo(1, 14)
  })
})

describe('energy-matched classical mechanics', () => {
  const { inertia } = molecularParameters(14.007, 1.1)
  it('derives inertia from reduced mass and bond length coherently', () => {
    expect(molecularParameters(28.014, 1.1).inertia / inertia).toBeCloseTo(2, 14)
    expect(molecularParameters(14.007, 2.2).inertia / inertia).toBeCloseTo(4, 14)
  })
  it('calculates energy, momentum, angular velocity and period for every state', () => {
    for (let j = 0; j <= 10; j++) for (let m = -j; m <= j; m++) {
      const q = quantumQuantities(j, m, inertia)
      expect(q.energy).toBe(HBAR ** 2 * j * (j + 1) / (2 * inertia))
      expect(q.projection).toBe(m * HBAR)
      if (j === 0) { expect(q.omega).toBe(0); expect(q.period).toBe(Infinity); continue }
      expect(q.omega / (HBAR / inertia * Math.sqrt(j * (j + 1)))).toBeCloseTo(1, 14)
      expect((0.5 * inertia * q.omega ** 2) / q.energy).toBeCloseTo(1, 14)
      expect(q.period * q.omega).toBeCloseTo(2 * Math.PI, 14)
    }
  })
  it('keeps center of mass at zero, bond length constant and bond perpendicular to L', () => {
    for (let j = 1; j <= 10; j++) for (let m = -j; m <= j; m++) {
      const axis = angularMomentumAxis(j, m, 37)!
      expect(axis[2]).toBeCloseTo(m / Math.sqrt(j * (j + 1)), 14)
      for (const phase of [0, 0.31, 1.7, 3.14, 6]) {
        const [a, b] = atomPositions(axis, phase, 1.1e-10)
        expect(Math.hypot(...a.map((x, i) => (x + b[i]) / 2))).toBe(0)
        expect(Math.hypot(...a.map((x, i) => x - b[i])) / 1.1e-10).toBeCloseTo(1, 14)
        expect(dot(rotorOrientation(axis, phase), axis)).toBeCloseTo(0, 14)
      }
    }
  })
  it('uses elapsed time independently of frame rate, supports pause and resets', () => {
    const q = quantumQuantities(1, 0, inertia)
    const slow = new ClassicalClock(0.4), fast = new ClassicalClock(0.4)
    for (let i = 0; i < 30; i++) slow.advance(1 / 30, q.omega, 1e-12, 1, false)
    for (let i = 0; i < 144; i++) fast.advance(1 / 144, q.omega, 1e-12, 1, false)
    expect(slow.phase).toBeCloseTo(fast.phase, 12)
    const phase = slow.phase
    slow.advance(10, q.omega, 1e-12, 1, true)
    expect(slow.phase).toBe(phase)
    slow.reset(1.2)
    expect(slow.phase).toBe(1.2)
    expect(slow.physicalTime).toBe(0)
  })
  it('automatically speeds up by sqrt(3) when J changes from 1 to 2', () => {
    const clock = new ClassicalClock()
    const q1 = quantumQuantities(1, 0, inertia), q2 = quantumQuantities(2, 0, inertia)
    const before = clock.advance(0.1, q1.omega, 1e-12, 1, false)
    const after = clock.advance(0.1, q2.omega, 1e-12, 1, false)
    expect((after - before) / before).toBeCloseTo(Math.sqrt(3), 14)
  })
  it('holds J=0 stationary and never constructs an artificial L direction', () => {
    const q = quantumQuantities(0, 0, inertia), clock = new ClassicalClock(0.7)
    for (let i = 0; i < 100; i++) clock.advance(1 / 30, q.omega, 1e-12, 3, false)
    expect(clock.phase).toBe(0.7)
    expect(angularMomentumAxis(0, 0, 30)).toBeNull()
  })
  it('holds the quantum polar angle fixed while changing only the free azimuth', () => {
    const expectedZ = 1 / Math.sqrt(6)
    for (const azimuth of [0, 45, 90, 180, 360]) {
      const axis = angularMomentumAxis(2, 1, azimuth)!
      expect(axis[2]).toBeCloseTo(expectedZ, 14)
      expect(Math.hypot(...axis)).toBeCloseTo(1, 14)
    }
    expect(angularMomentumAxis(2, 1, 90)![0]).toBeCloseTo(0, 14)
    expect(angularMomentumAxis(2, 1, 90)![1]).toBeGreaterThan(0.9)
    expect(angularMomentumAxis(2, 1)).toEqual(angularMomentumAxis(2, 1, 0))
  })
  it('uses the same display clock for J=10 and J=50, retaining their physical speed ratio', () => {
    const hydrogen = molecularParameters(1, 0.74)
    const low = quantumQuantities(10, 10, hydrogen.inertia), high = quantumQuantities(50, 50, hydrogen.inertia)
    const lowClock = new ClassicalClock(), highClock = new ClassicalClock()
    const lowPhase = lowClock.advance(0.01, low.omega, DISPLAY_TIME_SCALE, defaultSettings.playback, false)
    const highPhase = highClock.advance(0.01, high.omega, DISPLAY_TIME_SCALE, defaultSettings.playback, false)
    expect(highClock.physicalTime).toBe(lowClock.physicalTime)
    expect(highPhase).toBeGreaterThan(lowPhase)
    expect(highPhase / lowPhase).toBeCloseTo(Math.sqrt(50 * 51 / (10 * 11)), 12)
  })
  it('preserves the previous startup rotation rate when playback is relabeled as 1×', () => {
    expect(defaultSettings.playback).toBe(1)
    const hydrogen = molecularParameters(1, 0.74)
    for (const j of [0, 1, 10, 50]) {
      const { omega } = quantumQuantities(j, 0, hydrogen.inertia)
      const oldClock = new ClassicalClock(0.3), newClock = new ClassicalClock(0.3)
      const before = oldClock.advance(0.01, omega, 1e-12, 0.1, false)
      const after = newClock.advance(0.01, omega, DISPLAY_TIME_SCALE, defaultSettings.playback, false)
      expect(after).toBeCloseTo(before, 12)
      expect(newClock.physicalTime / oldClock.physicalTime).toBeCloseTo(1, 14)
    }
  })
})
