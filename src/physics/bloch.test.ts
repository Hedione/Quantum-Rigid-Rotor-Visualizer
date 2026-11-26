import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { blochState } from './bloch'
import { QuantumTimeline } from './evolution'
import { defaultRabiFrequency } from './transition'
import type { WaveCoefficients } from './superposition'

describe('rotational Bloch sphere', () => {
  it.each([
    [{ first: { re: 1, im: 0 }, second: { re: 0, im: 0 } }, [0, 0, 1]],
    [{ first: { re: 0, im: 0 }, second: { re: 1, im: 0 } }, [0, 0, -1]],
    [{ first: { re: 1, im: 0 }, second: { re: 1, im: 0 } }, [1, 0, 0]],
    [{ first: { re: 1, im: 0 }, second: { re: -1, im: 0 } }, [-1, 0, 0]],
    [{ first: { re: 1, im: 0 }, second: { re: 0, im: 1 } }, [0, 1, 0]],
    [{ first: { re: 1, im: 0 }, second: { re: 0, im: -1 } }, [0, -1, 0]],
  ] satisfies [WaveCoefficients, number[]][])('maps amplitudes %j onto %j', (coefficients, expected) => {
    const state = blochState(defaultSettings, coefficients)!
    for (const [i, axis] of (['x', 'y', 'z'] as const).entries()) expect(state[axis]).toBeCloseTo(expected[i], 12)
    expect(state.first + state.second).toBeCloseTo(1, 12)
    expect(Math.hypot(state.x, state.y, state.z)).toBeCloseTo(1, 12)
    if (Math.abs(expected[2]) === 1) expect(state.phase).toBeUndefined()
    else expect(state.phase).toBeCloseTo(Math.atan2(expected[1], expected[0]), 12)
  })

  it('ignores global phase and overall amplitude while retaining the relative phase', () => {
    const state = blochState(defaultSettings, { first: { re: 2, im: 1 }, second: { re: -1, im: 3 } })!
    const rotated = blochState(defaultSettings, { first: { re: -3, im: 6 }, second: { re: -9, im: -3 } })!
    for (const axis of ['x', 'y', 'z', 'first', 'second', 'phase'] as const) expect(rotated[axis]).toBeCloseTo(state[axis]!, 12)
  })

  it('uses the correct static defaults and rejects a duplicate rotational basis', () => {
    expect(blochState(defaultSettings)?.z).toBe(1)
    expect(blochState({ ...defaultSettings, superposition: true })?.x).toBeCloseTo(1, 12)
    expect(blochState({ ...defaultSettings, coherentTransition: true, superposition: true })?.z).toBe(1)
    expect(blochState({ ...defaultSettings, j2: 1, m2: 0 })).toBeUndefined()
  })

  it('follows the shared laboratory-frame clock through a pulse and a Rabi return', () => {
    for (const transitionLoop of [false, true]) {
      const timeline = new QuantumTimeline()
      const settings = { ...defaultSettings, j2: 2, m2: 0, dipoleMoment: 1, polarization: 'pi' as const, coherentTransition: true, transitionLoop, transitionPlaying: false }
      settings.rabiFrequency = defaultRabiFrequency(settings)
      timeline.configure(settings, 0)
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        timeline.configure({ ...settings, transitionProgress: progress }, 0)
        const state = blochState(settings, timeline.frame.coefficients)!
        expect(state.z).toBeCloseTo(Math.cos(progress * Math.PI * (transitionLoop ? 2 : 1)), 12)
        expect(Math.hypot(state.x, state.y, state.z)).toBeCloseTo(1, 12)
        expect(state.first + state.second).toBeCloseTo(1, 12)
      }
    }
  })
})
