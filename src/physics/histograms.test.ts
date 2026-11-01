import { describe, expect, it } from 'vitest'
import { HISTOGRAM_BIN_OPTIONS, MAX_HISTOGRAM_BINS, rebinCounts, rebinDensities } from './histograms'
import { OrientationEnsemble } from './sampling'
import { distributionAtPhase, prepareSuperpositionDistribution } from './superposition'

describe('adjustable orientation histograms', () => {
  it('can skip histogram work while the ensemble continues drawing, then records only the latest batch', () => {
    const engine = new OrientationEnsemble(0, 0, 732, 2000, { j: 1, m: 0 })
    const initial = engine.statistics(MAX_HISTOGRAM_BINS)
    for (let i = 1; i <= 60; i++) engine.regenerate(Math.PI * i / 60, false)
    const deferred = engine.statistics(MAX_HISTOGRAM_BINS)
    expect(deferred).toEqual(initial)
    let mean = 0
    for (let i = 0; i < engine.count; i++) mean += engine.orientations[i * 3 + 2]
    expect(mean / engine.count).toBeLessThan(-0.5)
    expect(engine.collectBatch()).toBe(true)
    const recorded = engine.statistics(MAX_HISTOGRAM_BINS)
    expect(recorded.total).toBe(4000)
    expect(recorded.relativePhase).toBeCloseTo(Math.PI, 12)
    expect(recorded.meanPhaseCosine).toBeCloseTo(0, 12)
    expect(recorded.histogram.reduce((a, b) => a + b, 0)).toBe(4000)
    expect(recorded.currentHistogram.reduce((a, b) => a + b, 0)).toBe(2000)
    expect(engine.collectBatch()).toBe(false)
    expect(engine.total).toBe(4000)
  })
  it('records an outstanding batch before resizing without duplicating the new samples', () => {
    const engine = new OrientationEnsemble(1, 0, 24, 10)
    engine.regenerate(0, false)
    engine.setCount(15)
    expect(engine.total).toBe(25)
    expect(engine.collectBatch()).toBe(false)
    const stats = engine.statistics(MAX_HISTOGRAM_BINS)
    expect(stats.histogram.reduce((a, b) => a + b, 0)).toBe(25)
    expect(stats.currentHistogram.reduce((a, b) => a + b, 0)).toBe(15)
  })
  it('preserves exact integer counts, current samples, and accumulated history at every resolution', () => {
    const engine = new OrientationEnsemble(2, 1, 921, 2000, { j: 1, m: 0 })
    engine.regenerate(0.8); engine.regenerate(2.1)
    const fine = engine.statistics(MAX_HISTOGRAM_BINS), orientations = engine.orientations.slice()
    for (const bins of HISTOGRAM_BIN_OPTIONS) {
      const actual = engine.statistics(bins)
      for (const name of ['histogram', 'azimuthHistogram', 'thetaHistogram', 'currentHistogram', 'currentAzimuthHistogram', 'currentThetaHistogram'] as const) {
        expect(actual[name]).toEqual(rebinCounts(fine[name], bins))
        expect(actual[name].every(Number.isInteger)).toBe(true)
        expect(actual[name].reduce((a, b) => a + b, 0)).toBe(name.startsWith('current') ? 2000 : 6000)
      }
    }
    expect(engine.orientations).toEqual(orientations)
    expect(engine.total).toBe(6000)
    engine.resetStatistics()
    expect(engine.statistics(MAX_HISTOGRAM_BINS).histogram.every(n => n === 0)).toBe(true)
    expect(engine.statistics(MAX_HISTOGRAM_BINS).currentHistogram.reduce((a, b) => a + b, 0)).toBe(2000)
  })
  it('rebins coherent theory without changing its normalization or temporal interference', () => {
    const state = { j: 50, m: 50, j2: 49, m2: -49, superposition: true }, phase = 0.7
    const fine = distributionAtPhase(prepareSuperpositionDistribution(state, MAX_HISTOGRAM_BINS), Math.cos(phase), Math.sin(phase))
    for (const bins of HISTOGRAM_BIN_OPTIONS) {
      const expected = distributionAtPhase(prepareSuperpositionDistribution(state, bins), Math.cos(phase), Math.sin(phase))
      for (const [name, domain] of [['polar', 2], ['theta', Math.PI], ['azimuthBins', 2 * Math.PI]] as const) {
        const rebinned = rebinDensities(fine[name]!, bins)
        expect(rebinned.reduce((a, b) => a + b, 0) * domain / bins).toBeCloseTo(1, 10)
        for (let i = 0; i < bins; i++) expect(rebinned[i]).toBeCloseTo(expected[name]![i], 9)
      }
    }
  })
})
