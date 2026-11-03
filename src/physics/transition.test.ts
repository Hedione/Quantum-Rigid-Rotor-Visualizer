import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { integrateGauss } from './integration'
import { createAngularWavefunction, densityMoments, distributionAtMoments, normalizeCoefficients, prepareSuperpositionDistribution } from './superposition'
import { electricField, laboratoryCoefficients, POLARIZATIONS, rabiCoefficients, transitionDipole, transitionRates, transitionTimeScale, validateTransition } from './transition'
import { QuantumTimeline } from './evolution'
import { sphericalHarmonic } from './quantum'
import { OrientationEnsemble } from './sampling'

const state = { ...defaultSettings, coherentTransition: true, superposition: true, j: 1, m: 1, j2: 2, m2: 0 }
const omega = Math.PI * 1e12, duration = Math.PI / omega
const sphereIntegral = (f: (u: number, phi: number) => number) => integrateGauss(u => Array.from({ length: 128 }, (_, i) => f(u, i * Math.PI / 64)).reduce((a, b) => a + b, 0) * Math.PI / 64, -1, 1, 96)

describe('resonant coherent transitions', () => {
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

  it('stays finite and normalized during rapid high-J phase evolution and resolves playback', () => {
    const s = { ...state, j: 50, m: 50, j2: 49, m2: 49, transitionPlaying: true, transitionPlayback: 100, rabiFrequency: 0.001 }
    const clock = new QuantumTimeline(); clock.configure(s, 0)
    const rates = transitionRates(s), scale = transitionTimeScale(s)
    expect(scale * Math.max(rates.first, rates.second)).toBeLessThanOrEqual(8 + 1e-12)
    for (const now of [1, 1e4, 1e7, 1e10, 1e20]) {
      const frame = clock.read(now), c = frame.coefficients!
      expect(Object.values(c).every(z => Number.isFinite(z.re + z.im))).toBe(true)
      const p = densityMoments(c)
      expect(p.first + p.second).toBeCloseTo(1, 13)
    }
  })
})

describe('polarization and electric-dipole angular coupling', () => {
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
    expect(validateTransition(pair).allowed).toBe(false)
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
