import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { QuantumTimeline, QUANTUM_TIME_SCALE } from './evolution'
import { DISPLAY_TIME_SCALE } from './classical'
import { HBAR, molecularParameters, quantumQuantities } from './quantum'
import { createAngularWavefunction, distributionAtPhase, prepareSuperpositionDistribution } from './superposition'
import { integrateGauss } from './integration'
import { OrientationEnsemble } from './sampling'

describe('coherent time evolution', () => {
  const settings = { ...defaultSettings, superposition: true, timeEvolution: true, j: 0, m: 0, j2: 1, m2: 0 }
  const { inertia } = molecularParameters(settings.atomMass, settings.bondLength)
  const rate = quantumQuantities(1, 0, inertia).energy / HBAR

  it('uses E/hbar and the physical clock, preserving time across pause and speed changes', () => {
    const clock = new QuantumTimeline(); clock.configure(settings, 1000)
    expect(clock.read(2000).time).toBeCloseTo(2e-14, 24)
    expect(clock.read(2000).secondPhase).toBeCloseTo(rate * 2e-14, 12)
    clock.tick(2000)
    expect(clock.frame.time).toBeCloseTo(2e-14, 24)
    clock.configure({ ...settings, quantumPlayback: 2 }, 2000)
    expect(clock.read(2500).time).toBeCloseTo(4e-14, 24)
    clock.configure({ ...settings, quantumPlayback: 2, ensemblePaused: true }, 2500)
    expect(clock.read(9000).time).toBeCloseTo(4e-14, 24)
    clock.configure({ ...settings, quantumPlayback: 2 }, 9000)
    expect(clock.read(9500).time).toBeCloseTo(6e-14, 24)
    clock.configure({ ...settings, j2: 2 }, 9500)
    expect(clock.read(9500).time).toBe(0)
    clock.configure({ ...settings, timeEvolution: false }, 10000)
    expect(clock.read(20000)).toMatchObject({ time: 0, firstPhase: 0, secondPhase: 0, enabled: false })
  })
  it.each([0.01, 1, 10, 100])('defaults evolution on and keeps time and phase accurate at %sx', speed => {
    const clock = new QuantumTimeline(); clock.configure(settings, 0)
    expect(defaultSettings.quantumPlayback).toBe(1)
    expect(defaultSettings.timeEvolution).toBe(true)
    expect(clock.read(1000).time / DISPLAY_TIME_SCALE).toBeCloseTo(0.2, 14)
    clock.configure({ ...settings, quantumPlayback: speed }, 1000)
    const before = clock.read(1000), after = clock.read(2000)
    expect(before.time).toBeCloseTo(QUANTUM_TIME_SCALE, 25)
    expect((after.time - before.time) / QUANTUM_TIME_SCALE).toBeCloseTo(speed, 12)
    expect(after.secondPhase).toBeCloseTo((rate * after.time) % (2 * Math.PI), 12)
  })
  it('uses both masses for evolution and resets the quantum clock when the inertia changes', () => {
    const clock = new QuantumTimeline(); clock.configure(settings, 0)
    const original = clock.read(500)
    clock.configure({ ...settings, asymmetricBond: true, atomMass2: 2 }, 500)
    expect(clock.read(500).time).toBe(0)
    const next = clock.read(1000)
    expect(next.time).toBeCloseTo(original.time, 26)
    expect(next.secondPhase / original.secondPhase).toBeCloseTo(0.75, 14)
  })
  it('keeps equal-J probability stationary while evolving the global complex phase', () => {
    const state = { ...settings, j: 2, m: 1, j2: 2, m2: -1 }
    const clock = new QuantumTimeline(); clock.configure(state, 0)
    const frame = clock.read(500), wave = createAngularWavefunction(state)
    expect(frame.relativePhase).toBe(0)
    const original = wave.evaluate(0.3, 0.7), evolved = wave.evaluate(0.3, 0.7, frame.firstPhase, frame.secondPhase)
    expect(evolved.probability).toBeCloseTo(original.probability, 13)
    expect(Math.abs(evolved.re - original.re) + Math.abs(evolved.im - original.im)).toBeGreaterThan(0.01)
  })
  it.each([0, Math.PI / 2, Math.PI, 1.3])('normalizes joint density and preserves analytic hemisphere interference at phase %s', phase => {
    const wave = createAngularWavefunction(settings)
    expect(integrateGauss(u => wave.polarDensity(u, phase), -1, 1)).toBeCloseTo(1, 12)
    expect(integrateGauss(u => u * wave.polarDensity(u, phase), -1, 1)).toBeCloseTo(Math.cos(phase) / Math.sqrt(3), 12)
    const theory = distributionAtPhase(prepareSuperpositionDistribution(settings), Math.cos(phase), Math.sin(phase))
    expect(theory.polar.reduce((sum, p) => sum + p / 20, 0)).toBeCloseTo(1, 12)
    for (let i = 0; i < 40; i++) {
      const expected = integrateGauss(u => wave.polarDensity(u, phase), -1 + i / 20, -1 + (i + 1) / 20) * 20
      expect(theory.polar[i]).toBeCloseTo(expected, 12)
    }
  })
  it('samples instantaneous density and accumulates the matching time-averaged theory', () => {
    const engine = new OrientationEnsemble(0, 0, 831, 5000, { j: 1, m: 0 })
    engine.resetStatistics()
    for (const phase of [0, Math.PI]) {
      let moment = 0
      for (let i = 0; i < 12; i++) {
        engine.regenerate(phase)
        for (let k = 0; k < engine.count; k++) moment += engine.orientations[k * 3 + 2]
      }
      expect(moment / (12 * engine.count)).toBeCloseTo(Math.cos(phase) / Math.sqrt(3), 2)
    }
    const stats = engine.statistics()
    expect(stats.meanPhaseCosine).toBeCloseTo(0, 12)
    expect(stats.relativePhase).toBe(Math.PI)
    const average = distributionAtPhase(prepareSuperpositionDistribution(settings), stats.meanPhaseCosine!, stats.meanPhaseSine!)
    for (let i = 0; i < 40; i++) expect(average.polar[i]).toBeCloseTo(average.polar[39 - i], 12)
  })
  it('uses the same signed temporal phase in the azimuthal sampler and theory', () => {
    const state = { ...settings, m2: 1 }, phase = -Math.PI / 2
    const engine = new OrientationEnsemble(0, 0, 248, 5000, { j: 1, m: 1 })
    let y = 0
    for (let batch = 0; batch < 16; batch++) {
      engine.regenerate(phase)
      for (let k = 0; k < engine.count; k++) y += engine.orientations[k * 3 + 1]
    }
    expect(y / (16 * engine.count)).toBeCloseTo(-1 / Math.sqrt(6), 2)
    const theory = distributionAtPhase(prepareSuperpositionDistribution(state), Math.cos(phase), Math.sin(phase))
    const wave = createAngularWavefunction(state)
    for (const i of [25, 100, 175, 300]) {
      const phi = i * 2 * Math.PI / 400
      const expected = integrateGauss(u => wave.evaluate(u, phi, phase).probability, -1, 1, 512)
      expect(theory.azimuth[i]).toBeCloseTo(expected, 7)
    }
  })
})
