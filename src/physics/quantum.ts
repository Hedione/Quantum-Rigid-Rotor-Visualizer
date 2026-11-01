/** Normalized complex spherical harmonics, including the Condon–Shortley phase. */
export const HBAR = 1.054571817e-34
export const ATOMIC_MASS = 1.66053906892e-27
export const ANGSTROM = 1e-10
export const ELECTRON_VOLT = 1.602176634e-19
export const LOW_J_LIMIT = 10
export const HIGH_J_LIMIT = 50
export const MAX_J = 200

export function validateState(j: number, m: number) {
  if (!Number.isInteger(j) || j < 0 || j > MAX_J || !Number.isInteger(m) || Math.abs(m) > j) {
    throw new RangeError(`Use integer J ∈ [0, ${MAX_J}] and m ∈ [−J, J].`)
  }
}

export function factorial(n: number): number {
  let value = 1
  for (let i = 2; i <= n; i++) value *= i
  return value
}

export function associatedLegendre(j: number, m: number, x: number): number {
  if (!Number.isInteger(j) || !Number.isInteger(m) || m < 0 || m > j) throw new RangeError('Invalid polynomial degree/order')
  x = Math.max(-1, Math.min(1, x))
  let pmm = 1
  const root = Math.sqrt(Math.max(0, 1 - x * x))
  for (let i = 1; i <= m; i++) pmm *= -(2 * i - 1) * root
  if (j === m) return pmm
  let previous = pmm
  let current = x * (2 * m + 1) * pmm
  for (let l = m + 2; l <= j; l++) {
    const next = ((2 * l - 1) * x * current - (l + m - 1) * previous) / (l - m)
    previous = current
    current = next
  }
  return current
}

export function harmonicNormalization(j: number, absM: number): number {
  let logRatio = 0
  for (let n = j - absM + 1; n <= j + absM; n++) logRatio -= Math.log(n)
  return Math.exp(0.5 * (Math.log((2 * j + 1) / (4 * Math.PI)) + logRatio))
}

const amplitudeCache = new Map<string, (u: number) => number>()

/** Recur directly on N_lm P_l^m; separate factorials/polynomials overflow at high J. */
export function getPolarAmplitude(j: number, m: number): (u: number) => number {
  validateState(j, m)
  const a = Math.abs(m), key = `${j}:${a}`
  const cached = amplitudeCache.get(key)
  if (cached) return cached
  const diagonal = new Float64Array(a + 1)
  for (let k = 1; k <= a; k++) diagonal[k] = -Math.sqrt((2 * k + 1) / (2 * k))
  const first = Math.sqrt(2 * a + 3)
  const A = new Float64Array(j + 1), B = new Float64Array(j + 1)
  for (let l = a + 2; l <= j; l++) {
    A[l] = Math.sqrt((4 * l * l - 1) / (l * l - a * a))
    B[l] = Math.sqrt((2 * l + 1) / (2 * l - 3) * ((l - 1) ** 2 - a * a) / (l * l - a * a))
  }
  const evaluate = (u: number) => {
    u = Math.max(-1, Math.min(1, u))
    const root = Math.sqrt(Math.max(0, 1 - u * u))
    let previous = 1 / Math.sqrt(4 * Math.PI)
    for (let k = 1; k <= a; k++) previous *= diagonal[k] * root
    if (j === a) return previous
    let current = first * u * previous
    for (let l = a + 2; l <= j; l++) {
      const next = A[l] * u * current - B[l] * previous
      previous = current; current = next
    }
    return current
  }
  if (amplitudeCache.size >= 64) amplitudeCache.delete(amplitudeCache.keys().next().value!)
  amplitudeCache.set(key, evaluate)
  return evaluate
}

export function sphericalHarmonic(j: number, m: number, theta: number, phi: number) {
  validateState(j, m)
  const a = Math.abs(m)
  const amplitude = getPolarAmplitude(j, m)(Math.cos(theta))
  const sign = m < 0 ? (-1) ** a : 1
  const re = sign * amplitude * Math.cos(a * phi)
  const im = sign * amplitude * Math.sin(a * phi) * (m < 0 ? -1 : 1)
  return { re, im, magnitude: Math.abs(amplitude), probability: amplitude * amplitude, phase: Math.atan2(im, re) }
}

/** Density with respect to du, u = cos θ. This incorporates the solid-angle Jacobian. */
export function polarDensity(j: number, m: number, u: number): number {
  const p = getPolarAmplitude(j, m)(u)
  return 2 * Math.PI * p * p
}

/** Marginal density per radian, after integrating φ and including the solid-angle Jacobian. */
export function polarAngleDensity(j: number, m: number, theta: number): number {
  return polarDensity(j, m, Math.cos(theta)) * Math.max(0, Math.sin(theta))
}

/** Interior polar nodes bracketed in θ, which resolves high-J roots near the poles. */
export function polarNodeRoots(j: number, m: number): number[] {
  const amplitude = getPolarAmplitude(j, m), roots: number[] = []
  const steps = Math.max(1200, 16 * (j + 1))
  let lastX = -Math.cos(1e-8), previous = amplitude(lastX)
  for (let i = 1; i <= steps; i++) {
    const x = -Math.cos(Math.min(Math.PI - 1e-8, i * Math.PI / steps))
    const current = amplitude(x)
    if (current === 0) continue
    if (previous !== 0 && Math.sign(current) !== Math.sign(previous)) {
      let lo = lastX, hi = x, sign = Math.sign(previous)
      for (let k = 0; k < 35; k++) {
        const mid = (lo + hi) / 2, value = amplitude(mid)
        if (Math.sign(value) !== sign) hi = mid
        else lo = mid
      }
      roots.push((lo + hi) / 2)
    }
    lastX = x; previous = current
  }
  return roots
}

export function quantumQuantities(j: number, m: number, inertia: number) {
  validateState(j, m)
  if (!(inertia > 0) || !Number.isFinite(inertia)) throw new RangeError('Moment of inertia must be finite and positive')
  const angularMomentum = HBAR * Math.sqrt(j * (j + 1))
  const energy = HBAR * HBAR * j * (j + 1) / (2 * inertia)
  const omega = angularMomentum / inertia
  return { energy, angularMomentum, projection: m * HBAR, omega, period: omega === 0 ? Infinity : 2 * Math.PI / omega }
}

/** Equal atom masses, in u, and bond length, in Å; I = μ r², μ = m_atom / 2. */
export function molecularParameters(atomMass: number, bondLength: number) {
  if (!(atomMass > 0) || !(bondLength > 0) || !Number.isFinite(atomMass + bondLength)) throw new RangeError('Positive molecular parameters required')
  const reducedMass = atomMass * ATOMIC_MASS / 2
  const separation = bondLength * ANGSTROM
  return { reducedMass, separation, inertia: reducedMass * separation * separation }
}

export function adjacentState(j: number, m: number, direction: -1 | 1, maximum = MAX_J): [number, number] {
  if (direction === 1) return m < j ? [j, m + 1] : j < maximum ? [j + 1, -j - 1] : [0, 0]
  return m > -j ? [j, m - 1] : j > 0 ? [j - 1, j - 1] : [maximum, maximum]
}
