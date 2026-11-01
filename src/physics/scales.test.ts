import { describe, expect, it } from 'vitest'
import { logPosition, logValue } from './scales'

describe('logarithmic controls', () => {
  it.each([[1, 5000], [0.005, 0.75]])('maps endpoints and the geometric midpoint for [%s, %s]', (min, max) => {
    expect(logValue(0, min, max)).toBe(min)
    expect(logValue(1, min, max)).toBe(max)
    expect(logValue(0.5, min, max)).toBeCloseTo(Math.sqrt(min * max), 12)
    for (const position of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(logPosition(logValue(position, min, max), min, max)).toBeCloseTo(position, 14)
    }
  })
})
