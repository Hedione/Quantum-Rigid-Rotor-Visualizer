import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { integrateGauss } from './integration'
import { createAngularWavefunction, densityMoments, distributionAtMoments, normalizeCoefficients, prepareSuperpositionDistribution } from './superposition'
import { defaultRabiFrequency, dipoleExpectation, drivingFieldAmplitude, electricField, electromagneticWave, laboratoryCoefficients, POLARIZATIONS, rabiCoefficients, SPEED_OF_LIGHT, transitionDipole, transitionRates, transitionTarget, transitionTimeScale, validateTransition } from './transition'
import { QuantumTimeline } from './evolution'
import { HBAR, sphericalHarmonic } from './quantum'
import { DEBYE } from './molecule'
import { OrientationEnsemble } from './sampling'

const state = { ...defaultSettings, rabiFrequency: Math.PI, dipoleMoment: 1, coherentTransition: true, superposition: true, j: 1, m: 1, j2: 2, m2: 0 }
const omega = Math.PI * 1e12, duration = Math.PI / omega
const sphereIntegral = (f: (u: number, phi: number) => number) => integrateGauss(u => Array.from({ length: 128 }, (_, i) => f(u, i * Math.PI / 64)).reduce((a, b) => a + b, 0) * Math.PI / 64, -1, 1, 96)

describe('resonant coherent transitions', () => {
  it('defaults Ω to a tenth of the absolute resonance, including below and above the old input bounds', () => {
    for (const s of [defaultSettings, { ...state, atomMass: 200, atomMass2: 200, bondLength: 3, j: 0, m: 0, j2: 1 }, { ...state, atomMass: 0.1, atomMass2: 0.1, bondLength: 0.2, j: 9, m: 0, j2: 10 }]) {
      expect(defaultRabiFrequency(s) * 1e12 / Math.abs(transitionRates(s).resonance)).toBeCloseTo(0.1, 14)
    }
    expect(defaultSettings.rabiFrequency).toBe(defaultRabiFrequency(defaultSettings))
  })
  it('reports the positive photon frequency from the energy gap rather than the Rabi frequency', () => {
    for (const molecule of [state, { ...state, atomMass: 1, atomMass2: 19, asymmetricBond: true, bondLength: 0.92 }]) {
      const rates = transitionRates(molecule), expected = Math.abs(rates.second - rates.first) * HBAR / 6.62607015e-34
      expect(Math.abs(rates.photonFrequency / expected - 1)).toBeLessThan(1e-9)
      expect(rates.photonFrequency * rates.photonWavelength / SPEED_OF_LIGHT).toBeCloseTo(1, 14)
      expect(transitionRates({ ...molecule, rabiFrequency: 0.001, transitionPlayback: 10 }).photonFrequency).toBe(rates.photonFrequency)
      expect(transitionRates({ ...molecule, j: molecule.j2, m: molecule.m2, j2: molecule.j, m2: molecule.m }).photonFrequency).toBe(rates.photonFrequency)
    }
  })

  it.each(POLARIZATIONS)('propagates a transverse, phase-matched EM wave along +k for $label', ({ value: polarization, q }) => {
    const dot = (a: { x: number; y: number; z: number }, b: typeof a) => a.x * b.x + a.y * b.y + a.z * b.z
    const cross = (a: { x: number; y: number; z: number }, b: typeof a) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
    for (const sign of [1, -1]) {
      const s = { ...state, j: sign > 0 ? 0 : 1, m: sign > 0 ? 0 : -q, j2: sign > 0 ? 1 : 0, m2: sign > 0 ? q : 0, polarization }
      const omega = sign * 3.7e12, period = 2 * Math.PI / Math.abs(omega), wavelength = SPEED_OF_LIGHT * period
      const origin = electromagneticWave(s, omega, period * 0.31, 0.73)
      expect(origin.electric).toEqual(electricField(s, omega, period * 0.31, 0.73))
      for (const distance of [0, wavelength * 0.137, -wavelength * 0.41]) {
        const a = electromagneticWave(s, omega, period * 0.31, 0.73, distance)
        expect(dot(a.electric, a.direction)).toBe(0); expect(dot(a.magnetic, a.direction)).toBe(0)
        expect(dot(a.electric, a.magnetic)).toBeCloseTo(0, 14)
        expect(dot(a.electric, a.electric)).toBeCloseTo(dot(a.magnetic, a.magnetic), 14)
        const flow = cross(a.electric, a.magnetic)
        for (const axis of ['x', 'y', 'z'] as const) expect(flow[axis]).toBeCloseTo(dot(a.electric, a.electric) * a.direction[axis], 14)
        const moved = electromagneticWave(s, omega, period * 0.31 + period / 7, 0.73, distance + SPEED_OF_LIGHT * period / 7)
        const nextCycle = electromagneticWave(s, omega, period * 0.31, 0.73, distance + wavelength)
        for (const axis of ['x', 'y', 'z'] as const) {
          expect(moved.electric[axis]).toBeCloseTo(a.electric[axis], 13)
          expect(moved.magnetic[axis]).toBeCloseTo(a.magnetic[axis], 13)
          expect(nextCycle.electric[axis]).toBeCloseTo(a.electric[axis], 13)
        }
      }
    }
  })

  it('uses the selected playback rate directly, independently of molecular phase rates', () => {
    expect(defaultSettings.transitionPlayback).toBe(1)
    expect(transitionTimeScale(defaultSettings) * 1e15).toBe(1000)
    for (const molecule of [state, { ...state, atomMass: 200, atomMass2: 200, bondLength: 3 }]) {
      for (const multiplier of [0.001, 0.1, 1, 10]) {
        expect(transitionTimeScale({ ...molecule, transitionPlayback: multiplier }) / (1e-12 * multiplier)).toBeCloseTo(1, 14)
      }
    }
  })

  it('keeps every transition selector on an allowed neighboring state through all UI boundaries', () => {
    for (let j = 0; j <= 10; j++) for (let m = -j; m <= j; m++) for (const deltaJ of [-1, 1]) for (const deltaM of [-1, 0, 1]) {
      const target = transitionTarget(j, m, deltaJ, deltaM, 10)
      expect(target.j2).toBeGreaterThanOrEqual(0); expect(target.j2).toBeLessThanOrEqual(10)
      expect(Math.abs(target.j2 - j)).toBe(1)
      expect(Math.abs(target.m2)).toBeLessThanOrEqual(target.j2)
      expect(validateTransition({ ...state, j, m, ...target }).allowed).toBe(true)
      if (j + deltaJ >= 0 && j + deltaJ <= 10 && Math.abs(m + deltaM) <= j + deltaJ) expect(target).toMatchObject({ j2: j + deltaJ, m2: m + deltaM })
    }
  })

  it.each([0, 0.5, 1])('has exact π-pulse populations at progress %s and holds the endpoint', progress => {
    const c = rabiCoefficients(duration * progress, omega, 0.7), p = densityMoments(c)
    expect(p.first).toBeCloseTo(Math.cos(Math.PI * progress / 2) ** 2, 14)
    expect(p.second).toBeCloseTo(Math.sin(Math.PI * progress / 2) ** 2, 14)
    expect(p.first + p.second).toBeCloseTo(1, 14)
    if (progress === 1) expect(rabiCoefficients(duration * 20, omega, 0.7)).toEqual(c)
  })

  it('generalizes the existing evaluator to arbitrary normalized complex weights', () => {
    const c = normalizeCoefficients({ first: { re: 2, im: -3 }, second: { re: -4, im: 1 } })
    const wave = createAngularWavefunction(state), u = 0.43, phi = 1.1
    const a = sphericalHarmonic(1, 1, Math.acos(u), phi), b = sphericalHarmonic(2, 0, Math.acos(u), phi)
    const actual = wave.evaluate(u, phi, 0, 0, c)
    expect(actual.re).toBeCloseTo(c.first.re * a.re - c.first.im * a.im + c.second.re * b.re - c.second.im * b.im, 14)
    expect(actual.im).toBeCloseTo(c.first.re * a.im + c.first.im * a.re + c.second.re * b.im + c.second.im * b.re, 14)
    expect(sphereIntegral((u, phi) => wave.evaluate(u, phi, 0, 0, c).probability)).toBeCloseTo(1, 12)
    expect(() => normalizeCoefficients({ first: { re: 0, im: 0 }, second: { re: 0, im: 0 } })).toThrow()
  })

  it.each([0, 0.13, 0.5, 0.88, 1])('normalizes density, marginals and endpoints at progress %s', progress => {
    const c = laboratoryCoefficients(rabiCoefficients(duration * progress, omega, 0.4), 1.3, 4.7)
    const wave = createAngularWavefunction(state), theory = distributionAtMoments(prepareSuperpositionDistribution(state), densityMoments(c))
    expect(sphereIntegral((u, phi) => wave.evaluate(u, phi, 0, 0, c).probability)).toBeCloseTo(1, 12)
    expect(theory.polar.reduce((sum, p) => sum + p / 20, 0)).toBeCloseTo(1, 12)
    expect(theory.theta.reduce((sum, p) => sum + p * Math.PI / 40, 0)).toBeCloseTo(1, 12)
    for (const i of [30, 100, 220, 300]) {
      const phi = i * Math.PI / 200
      const expected = integrateGauss(u => wave.evaluate(u, phi, 0, 0, c).probability, -1, 1, 512)
      expect(theory.azimuth[i]).toBeCloseTo(expected, 7)
    }
    if (progress === 0 || progress === 1) for (const u of [-0.7, 0.2, 0.9]) {
      const j = progress === 0 ? state.j : state.j2, m = progress === 0 ? state.m : state.m2
      expect(wave.evaluate(u, 0.8, 0, 0, c).probability).toBeCloseTo(sphericalHarmonic(j, m, Math.acos(u), 0.8).probability, 14)
    }
  })

  it('retains interference and phase-dependent azimuthal asymmetry', () => {
    const wave = createAngularWavefunction(state), u = 0.35, phi = 0.8
    const a = rabiCoefficients(duration / 2, omega, 0), b = rabiCoefficients(duration / 2, omega, Math.PI)
    const pa = wave.evaluate(u, phi, 0, 0, a).probability, pb = wave.evaluate(u, phi, 0, 0, b).probability
    const mixture = (sphericalHarmonic(1, 1, Math.acos(u), phi).probability + sphericalHarmonic(2, 0, Math.acos(u), phi).probability) / 2
    expect(Math.abs(pa - mixture)).toBeGreaterThan(0.01)
    expect(pa + pb).toBeCloseTo(2 * mixture, 14)
    expect(Math.abs(pa - wave.evaluate(u, -phi, 0, 0, a).probability)).toBeGreaterThan(0.01)
  })

  it('matches polar interference for Δm=0 with arbitrary phase and unequal weights', () => {
    const s = { ...state, j: 0, m: 0, j2: 1, m2: 0 }, wave = createAngularWavefunction(s)
    const c = laboratoryCoefficients(rabiCoefficients(duration * 0.31, omega, 0.6), 0, 1.8)
    const theory = distributionAtMoments(prepareSuperpositionDistribution(s), densityMoments(c))
    for (let i = 0; i < 40; i++) {
      const expected = integrateGauss(u => wave.polarDensity(u, 0, c), -1 + i / 20, -1 + (i + 1) / 20) * 20
      expect(theory.polar[i]).toBeCloseTo(expected, 12)
    }
    expect(wave.polarDensity(0.3, 0, c)).toBeCloseTo(2 * Math.PI * wave.evaluate(0.3, 0, 0, 0, c).probability, 13)
    const rotating = rabiCoefficients(duration * 0.31, omega, 0.6)
    expect(wave.polarDensity(0.3, -1.8, rotating)).toBeCloseTo(wave.polarDensity(0.3, 0, c), 13)
  })

  it('samples unequal populations and accumulated interference with matching theory', () => {
    const engine = new OrientationEnsemble(0, 0, 919, 5000, { j: 1, m: 0 })
    engine.resetStatistics()
    let mean = 0
    for (const progress of [0.1, 0.3, 0.6, 1]) {
      const c = rabiCoefficients(duration * progress, omega, Math.PI / 2)
      for (let batch = 0; batch < 10; batch++) {
        engine.regenerate(0, true, c)
        for (let i = 0; i < engine.count; i++) mean += engine.orientations[i * 3 + 2]
      }
    }
    const stats = engine.statistics(), expected = stats.meanMoments!.cosine / Math.sqrt(3)
    expect(mean / stats.total).toBeCloseTo(expected, 2)
    const theory = distributionAtMoments(prepareSuperpositionDistribution({ j: 0, m: 0, superposition: true, j2: 1, m2: 0 }), stats.meanMoments!)
    expect(theory.polar.reduce((sum, p) => sum + p / 20, 0)).toBeCloseTo(1, 12)
    expect(stats.moments!.second).toBe(1)
  })

  it('continues Rabi oscillations through repeated returns without discarding their global sign', () => {
    for (const pulses of [0, 0.5, 1, 1.5, 2, 3, 4, 6.5, 400.25]) {
      const phase = 0.7, angle = Math.PI * pulses / 2
      const c = rabiCoefficients(duration * pulses, omega, phase, true), p = densityMoments(c)
      expect(c.first.re).toBeCloseTo(Math.cos(angle), 12)
      expect(c.second.re).toBeCloseTo(Math.sin(phase) * Math.sin(angle), 12)
      expect(c.second.im).toBeCloseTo(-Math.cos(phase) * Math.sin(angle), 12)
      expect(p.first + p.second).toBeCloseTo(1, 14)
    }
    expect(rabiCoefficients(2 * duration, omega, 0, true).first.re).toBe(-1)
    expect(rabiCoefficients(4 * duration, omega, 0, true).first.re).toBe(1)
  })

  it('loops the population while laboratory time and phase keep advancing', () => {
    const clock = new QuantumTimeline(), s = { ...state, transitionPlaying: true, transitionLoop: true }
    const scale = transitionTimeScale(s), rates = transitionRates(s)
    clock.configure(s, 0)
    for (const pulses of [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4.25, 40.5]) {
      const time = pulses * duration, frame = clock.read(time / scale * 1000)
      expect(frame.time).toBeCloseTo(time, 24)
      expect(frame.progress).toBeCloseTo((pulses / 2) % 1, 12)
      expect(densityMoments(frame.coefficients!).second).toBeCloseTo(Math.sin(Math.PI * pulses / 2) ** 2, 12)
      expect(frame.firstPhase).toBeCloseTo((rates.first * time) % (2 * Math.PI), 11)
      const amplitude = Math.cos(Math.PI * pulses / 2)
      expect(frame.coefficients!.first.re).toBeCloseTo(amplitude * Math.cos(rates.first * time), 11)
      expect(frame.coefficients!.first.im).toBeCloseTo(-amplitude * Math.sin(rates.first * time), 11)
    }
  })

  it('pauses, seeks the return leg, resets and exits loop mode deterministically', () => {
    const clock = new QuantumTimeline(), s = { ...state, transitionPlaying: true, transitionLoop: true }
    const stop = 1.5 * duration / transitionTimeScale(s) * 1000
    clock.configure(s, 0)
    clock.configure({ ...s, transitionPlaying: false }, stop)
    expect(clock.read(stop + 1e5)).toEqual(clock.read(stop))
    clock.configure({ ...s, transitionPlaying: false, transitionProgress: 0.75, transitionRun: 1 }, stop + 1e5)
    expect(clock.frame.progress).toBeCloseTo(0.75, 14)
    expect(clock.frame.time).toBeCloseTo(1.5 * duration, 25)
    expect(densityMoments(clock.frame.coefficients!).second).toBeCloseTo(0.5, 14)
    clock.configure({ ...s, transitionProgress: 0, transitionRun: 2 }, stop + 1e5)
    expect(clock.frame.time).toBe(0)
    clock.configure({ ...s, transitionLoop: false, transitionPlaying: false }, stop + 1e5 + 100)
    expect(clock.frame.time).toBe(0)
    clock.configure({ ...s, transitionLoop: false }, stop + 1e5 + 100)
    expect(clock.read(1e8).progress).toBe(1)
    expect(clock.read(1e8)).toEqual(clock.read(2e8))
  })

  it('keeps deterministic physical time through play, pause, speed, phase, seek, replay and completion', () => {
    const clock = new QuantumTimeline(), s = { ...state, transitionPlaying: true }
    clock.configure(s, 0)
    const scale = transitionTimeScale(s), halfDisplayMs = duration / scale * 500
    clock.tick(halfDisplayMs)
    expect(clock.frame.progress).toBeCloseTo(0.5, 14)
    expect(densityMoments(clock.frame.coefficients!).second).toBeCloseTo(0.5, 14)
    clock.configure({ ...s, transitionPlaying: false }, halfDisplayMs)
    const frozen = clock.read(halfDisplayMs)
    expect(clock.read(halfDisplayMs + 10000)).toEqual(frozen)
    clock.configure({ ...s, transitionPlaying: false, drivePhase: 1.2, transitionPlayback: 100 }, halfDisplayMs + 10000)
    expect(clock.frame.time).toBe(frozen.time)
    expect(clock.frame.coefficients).not.toEqual(frozen.coefficients)
    clock.configure({ ...s, transitionProgress: 0.25, transitionRun: 1, transitionPlaying: false }, 20000)
    expect(clock.frame.progress).toBeCloseTo(0.25, 14)
    clock.configure({ ...s, transitionProgress: 0, transitionRun: 2 }, 20000)
    expect(clock.frame.progress).toBe(0)
    expect(clock.read(1e9).progress).toBe(1)
    expect(clock.read(1e9)).toEqual(clock.read(2e9))
    expect(densityMoments(clock.read(1e9).coefficients!).second).toBeCloseTo(1, 14)
  })

  it('rejects incompatible driving, resets on state/inertia changes and shares the sampling pause', () => {
    const clock = new QuantumTimeline(), s = { ...state, transitionPlaying: true }
    clock.configure(s, 0)
    clock.configure({ ...s, ensemblePaused: true }, 1000)
    const t = clock.read(1000).time
    expect(clock.read(10000).time).toBe(t)
    clock.configure({ ...s, polarization: 'pi' }, 10000)
    expect(clock.read(1e8).progress).toBe(0)
    expect(densityMoments(clock.read(1e8).coefficients!).first).toBe(1)
    clock.configure(s, 10000)
    clock.configure({ ...s, bondLength: 1.1 }, 11000)
    expect(clock.frame.progress).toBe(0)
  })

  it('retains uncapped high-J playback while keeping analytic coefficients finite and normalized', () => {
    const s = { ...state, j: 50, m: 50, j2: 49, m2: 49, transitionPlaying: true, transitionPlayback: 100, rabiFrequency: 0.001 }
    const clock = new QuantumTimeline(); clock.configure(s, 0)
    const rates = transitionRates(s), scale = transitionTimeScale(s)
    expect(scale).toBe(1e-12 * s.transitionPlayback)
    expect(scale * Math.max(rates.first, rates.second)).toBeGreaterThan(8)
    expect(clock.read(1000).time).toBeCloseTo(scale, 25)
    for (const now of [1, 1e4, 1e7, 1e10, 1e20]) {
      const frame = clock.read(now), c = frame.coefficients!
      expect(Object.values(c).every(z => Number.isFinite(z.re + z.im))).toBe(true)
      const p = densityMoments(c)
      expect(p.first + p.second).toBeCloseTo(1, 13)
    }
  })
})

describe('polarization and electric-dipole angular coupling', () => {
  it.each(POLARIZATIONS)('preserves the physical loop dipole phase through 180° for $label', ({ value: polarization, q }) => {
    const turn = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)
    for (const j of [0, 2]) for (const phase of [0, 0.61]) {
      const base = { ...state, j, m: 0, j2: 1, m2: q, polarization }
      const rates = transitionRates(base), omegaRabi = Math.abs(rates.resonance) / 10
      const s = { ...base, rabiFrequency: omegaRabi / 1e12, drivePhase: phase, transitionLoop: true, transitionPlaying: true }
      const d = transitionDipole(s), clock = new QuantumTimeline()
      clock.configure(s, 0)
      const at = (time: number) => {
        const frame = clock.read(time / transitionTimeScale(s) * 1000)
        return { e: electricField(s, rates.resonance, frame.time, phase, d), mu: dipoleExpectation(s, frame.coefficients!, d) }
      }
      for (const degrees of [30, 90, 150, 179.9, 180, 180.1, 210, 270, 330, 359.9, 360, 360.1]) {
        const angle = degrees * Math.PI / 180, time = angle / omegaRabi
        const { e, mu } = at(time)
        const envelope = s.dipoleMoment * Math.abs(d) * Math.sin(angle)
        if (q === 0) {
          expect(mu.z).toBeCloseTo(-s.dipoleMoment * d * Math.sin(angle) * Math.sin(rates.resonance * time - phase), 11)
        } else {
          expect(mu.x).toBeCloseTo(envelope * q * e.y / Math.SQRT2, 11)
          expect(mu.y).toBeCloseTo(-envelope * q * e.x / Math.SQRT2, 11)
          if (Math.abs(Math.sin(angle)) > 1e-9) {
            const h = 1e-5 / Math.abs(rates.resonance), before = at(time - h), after = at(time + h)
            const fieldTurn = turn(before.e, after.e), dipoleTurn = turn(before.mu, after.mu)
            expect(fieldTurn / (2 * h * rates.resonance)).toBeCloseTo(q, 6)
            expect(dipoleTurn / fieldTurn).toBeCloseTo(1, 6)
          }
        }
        if (degrees === 180 || degrees === 360) expect(Math.hypot(mu.x, mu.y, mu.z)).toBeLessThan(1e-12)
      }
    }
  })

  it('blocks nonpolar molecules, resets a changed dipole, and resumes only a polar pulse', () => {
    const clock = new QuantumTimeline(), s = { ...state, transitionPlaying: true }
    for (const dipoleMoment of [0, -1, NaN, Infinity]) {
      const nonpolar = { ...s, dipoleMoment }
      expect(validateTransition(nonpolar).reason).toContain('positive dipole moment')
      expect(drivingFieldAmplitude(nonpolar)).toBe(0)
      clock.configure(nonpolar, 0)
      expect(clock.read(1e6).progress).toBe(0)
    }
    clock.configure(s, 1e6)
    expect(clock.read(1e6 + 1000).progress).toBeGreaterThan(0)
    clock.configure({ ...s, dipoleMoment: 2 }, 1e6 + 1000)
    expect(clock.frame.progress).toBe(0)
    expect(clock.read(1e6 + 2000).progress).toBeGreaterThan(0)
  })

  it.each(POLARIZATIONS)('matches the real field amplitude to the resonant Hamiltonian for $label', ({ value: polarization, q }) => {
    const s = { ...state, j: 0, m: 0, j2: 1, m2: q, polarization, dipoleMoment: 1.827 }
    const amplitude = drivingFieldAmplitude(s), d = transitionDipole(s)
    const rotatingCoupling = s.dipoleMoment * DEBYE * Math.abs(d) * amplitude / (q === 0 ? 2 : Math.SQRT2)
    expect(rotatingCoupling / (HBAR * s.rabiFrequency * 1e12 / 2)).toBeCloseTo(1, 13)
    expect(drivingFieldAmplitude({ ...s, dipoleMoment: s.dipoleMoment * 2 }) / amplitude).toBeCloseTo(0.5, 13)
    expect(drivingFieldAmplitude({ ...s, rabiFrequency: s.rabiFrequency * 3 }) / amplitude).toBeCloseTo(3, 13)
  })

  it.each(POLARIZATIONS)('matches the lab dipole expectation to independent angular integration for $label', ({ value: polarization, q }) => {
    for (const j of [0, 2]) {
      const s = { ...state, j, m: 0, j2: 1, m2: q, polarization, dipoleMoment: 1.827 }
      const wave = createAngularWavefunction(s)
      for (const coefficients of [normalizeCoefficients({ first: { re: 2, im: -3 }, second: { re: -4, im: 1 } }), rabiCoefficients(0, omega, 0), rabiCoefficients(duration, omega, 0)]) {
        const actual = dipoleExpectation(s, coefficients)
        const density = (u: number, phi: number) => s.dipoleMoment * wave.evaluate(u, phi, 0, 0, coefficients).probability
        expect(actual.x).toBeCloseTo(sphereIntegral((u, phi) => density(u, phi) * Math.sqrt(1 - u * u) * Math.cos(phi)), 11)
        expect(actual.y).toBeCloseTo(sphereIntegral((u, phi) => density(u, phi) * Math.sqrt(1 - u * u) * Math.sin(phi)), 11)
        expect(actual.z).toBeCloseTo(sphereIntegral((u, phi) => density(u, phi) * u), 11)
        expect(Math.hypot(actual.x, actual.y, actual.z)).toBeLessThanOrEqual(s.dipoleMoment)
      }
    }
  })

  it('requires σ− for the default transition and gives 1/√15', () => {
    expect(validateTransition(state)).toMatchObject({ allowed: true, deltaJ: 1, deltaM: -1 })
    expect(transitionDipole(state)).toBeCloseTo(1 / Math.sqrt(15), 13)
    for (const polarization of ['pi', 'sigmaPlus'] as const) expect(validateTransition({ ...state, polarization }).allowed).toBe(false)
  })

  it.each(POLARIZATIONS)('matches analytical raising and lowering angular factors for $label', ({ value: polarization, q }) => {
    for (const j of [0, 1, 4, 10, 49]) for (const m of [...new Set([-j, 0, j])]) {
      const up = { ...state, j, m, j2: j + 1, m2: m + q, polarization }
      const denominator = (2 * j + 1) * (2 * j + 3)
      const expected = q === 0 ? Math.sqrt(((j + 1) ** 2 - m * m) / denominator) : Math.sqrt((j + q * m + 1) * (j + q * m + 2) / (2 * denominator))
      expect(transitionDipole(up)).toBeCloseTo(expected, 11)
      expect(validateTransition(up).allowed).toBe(true)
      const down = { ...up, j: up.j2, m: up.m2, j2: j, m2: m, polarization: q === 0 ? 'pi' : q === 1 ? 'sigmaMinus' : 'sigmaPlus' } as typeof up
      expect(transitionDipole(down)).toBeCloseTo((q === 0 ? 1 : -1) * expected, 11)
      expect(validateTransition(down).allowed).toBe(true)
    }
  })

  it.each([
    { j: 0, m: 0, j2: 0, m2: 0, polarization: 'pi' },
    { j: 1, m: 0, j2: 1, m2: 1, polarization: 'sigmaPlus' },
    { j: 0, m: 0, j2: 2, m2: 0, polarization: 'pi' },
    { j: 1, m: -1, j2: 2, m2: 2, polarization: 'sigmaPlus' },
  ] as const)('rejects forbidden transitions and zero matrix elements: %o', pair => {
    expect(validateTransition({ ...state, ...pair }).allowed).toBe(false)
    expect(transitionDipole(pair)).toBe(0)
  })

  it('uses transverse Cartesian fields with opposite circular rotation and π along z', () => {
    const plus = { ...state, j: 0, m: 0, j2: 1, m2: 1, polarization: 'sigmaPlus' as const }
    const minus = { ...plus, m2: -1, polarization: 'sigmaMinus' as const }
    const e0 = electricField(plus, 1, 0, 0), ep = electricField(plus, 1, Math.PI / 2, 0)
    const n0 = electricField(minus, 1, 0, 0), np = electricField(minus, 1, Math.PI / 2, 0)
    expect(e0.x * ep.y - e0.y * ep.x).toBeCloseTo(1, 13)
    expect(n0.x * np.y - n0.y * np.x).toBeCloseTo(-1, 13)
    for (const time of [0, 0.4, 1.2]) {
      const e = electricField(plus, 1, time, 0.7)
      expect(e.x * e.x + e.y * e.y).toBeCloseTo(1, 14); expect(e.z).toBe(0)
      const linear = electricField({ ...plus, m2: 0, polarization: 'pi' }, 1, time, 0)
      expect(linear.x).toBe(0); expect(linear.y).toBe(0)
    }
    // Operational Δm=+1 for stimulated emission requires opposite helicity.
    const down = { ...plus, j: 1, m: 0, j2: 0, m2: 0, polarization: 'pi' as const }
    expect(electricField(down, -1, 0, 0).z).toBeCloseTo(-1, 13)
  })

  it.each(POLARIZATIONS)('Cartesian coupling has the stated effective drive phase for $label', ({ value: polarization, q }) => {
    const s = { ...state, j: 0, m: 0, j2: 1, m2: q, polarization }, dipole = transitionDipole(s), phase = 0.6
    // Fourier coefficient of −<f|n·E|i> at exp(−iωt) must have arg φd.
    let re = 0, im = 0
    for (let i = 0; i < 128; i++) {
      const t = i * Math.PI / 64, e = electricField(s, 1, t, phase)
      const hRe = q === 0 ? -dipole * e.z : q * dipole * e.x / Math.SQRT2
      const hIm = q === 0 ? 0 : -dipole * e.y / Math.SQRT2
      re += hRe * Math.cos(t) - hIm * Math.sin(t)
      im += hRe * Math.sin(t) + hIm * Math.cos(t)
    }
    expect(Math.atan2(im, re)).toBeCloseTo(phase, 13)
    expect(Math.hypot(re, im) / 128).toBeCloseTo(Math.abs(dipole) / (q === 0 ? 2 : Math.SQRT2), 13)
  })
})
