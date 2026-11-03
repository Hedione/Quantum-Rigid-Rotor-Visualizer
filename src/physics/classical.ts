export type Vec3 = [number, number, number]
/** 0.1 ps per display second at 1×, shared by every J and both components. */
export const DISPLAY_TIME_SCALE = 1e-13
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (v: Vec3): Vec3 => { const n = Math.hypot(...v); return v.map(x => x / n) as Vec3 }

export function angularMomentumAxis(j: number, m: number, azimuthDegrees = 0): Vec3 | null {
  if (j === 0) return null
  const beta = Math.acos(m / Math.sqrt(j * (j + 1)))
  const azimuth = azimuthDegrees * Math.PI / 180
  return [Math.sin(beta) * Math.cos(azimuth), Math.sin(beta) * Math.sin(azimuth), Math.cos(beta)]
}

export function rotationBasis(axis: Vec3) {
  const k = normalize(axis)
  const helper: Vec3 = Math.abs(k[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]
  const e1 = normalize(cross(helper, k))
  const e2 = cross(k, e1)
  return { k, e1, e2 }
}

export function rotorOrientation(axis: Vec3, phase: number): Vec3 {
  const { e1, e2 } = rotationBasis(axis)
  return e1.map((x, i) => Math.cos(phase) * x + Math.sin(phase) * e2[i]) as Vec3
}

export function atomPositions(axis: Vec3, phase: number, bondLength: number, firstMass = 1, secondMass = firstMass): [Vec3, Vec3] {
  const n = rotorOrientation(axis, phase)
  return [n.map(x => x * bondLength * secondMass / (firstMass + secondMass)) as Vec3, n.map(x => -x * bondLength * firstMass / (firstMass + secondMass)) as Vec3]
}

/** Integrates physical time from render delta; phase stays continuous when ω changes. */
export class ClassicalClock {
  phase: number
  physicalTime = 0
  constructor(initialPhase = 0) { this.phase = initialPhase }
  advance(deltaSeconds: number, physicalOmega: number, secondsPerDisplaySecond: number, playback: number, paused: boolean) {
    if (paused) return this.phase
    const dt = deltaSeconds * secondsPerDisplaySecond * playback
    this.physicalTime += dt
    this.phase = (this.phase + physicalOmega * dt) % (2 * Math.PI)
    return this.phase
  }
  reset(initialPhase = 0) { this.phase = initialPhase; this.physicalTime = 0 }
}
