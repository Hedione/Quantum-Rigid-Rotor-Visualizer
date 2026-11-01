/** Map physical values to/from a normalized logarithmic slider position. */
export function logPosition(value: number, min: number, max: number) {
  return Math.max(0, Math.min(1, Math.log(value / min) / Math.log(max / min)))
}

export function logValue(position: number, min: number, max: number) {
  if (position <= 0) return min
  if (position >= 1) return max
  return min * (max / min) ** position
}
