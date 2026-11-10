const SI_PREFIXES = ['q', 'r', 'y', 'z', 'a', 'f', 'p', 'n', 'µ', 'm', '', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q']

/** Up to three significant digits, with a prefix keeping the magnitude in [1, 1000). */
export function formatSI(value: number, unit: string) {
  if (value === 0) return { value: '0', unit }
  if (!Number.isFinite(value)) return undefined
  let power = Math.max(-10, Math.min(10, Math.floor(Math.log10(Math.abs(value)) / 3)))
  let scaled = Number((value / 10 ** (power * 3)).toPrecision(3))
  if (Math.abs(scaled) >= 1000 && power < 10) {
    power++
    scaled /= 1000
  }
  if (Math.abs(scaled) < 1 || Math.abs(scaled) >= 1000) return undefined
  return { value: String(scaled), unit: `${SI_PREFIXES[power + 10]}${unit}` }
}
