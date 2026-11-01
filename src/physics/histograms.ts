export const HISTOGRAM_BINS = 40
export const HISTOGRAM_BIN_OPTIONS: readonly number[] = [10, 20, 40, 80, 160, 320]
export const MAX_HISTOGRAM_BINS = 320
export const DIAGNOSTICS_HZ = 60

/** All selectable resolutions divide the finest grid, preserving integer counts. */
export function rebinCounts(source: ArrayLike<number>, bins: number): number[] {
  if (source.length % bins !== 0) throw new RangeError('Histogram resolutions must divide the source grid')
  const factor = source.length / bins, result = Array<number>(bins).fill(0)
  for (let i = 0; i < source.length; i++) result[Math.floor(i / factor)] += source[i]
  return result
}

export function rebinDensities(source: ArrayLike<number>, bins: number): number[] {
  const factor = source.length / bins
  return rebinCounts(source, bins).map(value => value / factor)
}
