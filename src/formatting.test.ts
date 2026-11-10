import { describe, expect, it } from 'vitest'
import { formatSI } from './formatting'

describe('prefixed unit readouts', () => {
  it.each([
    [0, 'Hz', '0', 'Hz'], [230e9, 'Hz', '230', 'GHz'], [3.77e12, 'Hz', '3.77', 'THz'],
    [999.4e6, 'Hz', '999', 'MHz'], [999.5e6, 'Hz', '1', 'GHz'], [1e3, 'Hz', '1', 'kHz'],
    [79.5e-6, 'm', '79.5', 'µm'], [1.3e-3, 'm', '1.3', 'mm'], [0.9995e-3, 'm', '1', 'mm'],
    [-0.378, 'D', '-378', 'mD'], [1.31e8, 'V/m', '131', 'MV/m'],
  ] as const)('formats %s %s without an exponent', (value, unit, number, prefixedUnit) => {
    expect(formatSI(value, unit)).toEqual({ value: number, unit: prefixedUnit })
  })
  it('keeps all available prefix ranges and their rounding boundaries within one to three integer digits', () => {
    for (let power = -30; power <= 30; power += 3) for (const magnitude of [1, 1.234, 9.999, 99.99, 999.4]) {
      const result = formatSI(magnitude * 10 ** power, 'Hz')!
      expect(Number(result.value)).toBeGreaterThanOrEqual(1)
      expect(Number(result.value)).toBeLessThan(1000)
      expect(result.value).not.toMatch(/[eE]/)
    }
  })
  it('leaves unsupported magnitudes and nonfinite values to scientific notation', () => {
    for (const value of [1e-34, 1e33, Infinity, NaN]) expect(formatSI(value, 'm')).toBeUndefined()
  })
})
