import type { Polarization, Settings } from '../types'
import { integrateGauss } from './integration'
import { DEBYE, getMolecularParameters } from './molecule'
import { HBAR, quantumQuantities, validateState } from './quantum'
import { densityMoments, initialCoefficients, signedPolarAmplitude, type WaveCoefficients } from './superposition'

export const POLARIZATIONS = [
  { value: 'pi', label: 'Linear z (π): Δm = 0', q: 0 },
  { value: 'sigmaPlus', label: 'Circular xy (σ+): Δm = +1', q: 1 },
  { value: 'sigmaMinus', label: 'Circular xy (σ−): Δm = −1', q: -1 },
] as const
export const polarizationOrder = (p: Polarization) => POLARIZATIONS.find(option => option.value === p)!.q
type TransitionState = Pick<Settings, 'j' | 'm' | 'j2' | 'm2' | 'polarization'>

/** Keep the selected changes when possible; follow valid neighbors at state boundaries. */
export function transitionTarget(j: number, m: number, deltaJ: number, deltaM: number, maximum: number) {
  const j2 = j + deltaJ >= 0 && j + deltaJ <= maximum ? j + deltaJ : j - deltaJ
  const m2 = Math.max(-j2, Math.min(j2, m + deltaM))
  const polarization: Polarization = m2 === m ? 'pi' : m2 > m ? 'sigmaPlus' : 'sigmaMinus'
  return { j2, m2, polarization }
}

export const TRANSITION_TIME_SCALE = 1e-12
// Exact SI value: https://physics.nist.gov/cgi-bin/cuu/Value?c
export const SPEED_OF_LIGHT = 299792458

/** <Jf mf|C^1_q|Ji mi>, C0=cosθ, C±1=∓sinθ exp(±iφ)/√2.
 * The azimuth integral is exact; Gauss quadrature uses the simulator's signed
 * normalized harmonics. Equivalent to the Gaunt/3-j integral (DLMF 34.3.22).
 * https://dlmf.nist.gov/34.3.E22 */
export function transitionDipole(s: TransitionState): number {
  validateState(s.j, s.m); validateState(s.j2, s.m2)
  const q = polarizationOrder(s.polarization)
  if (s.m2 - s.m !== q) return 0
  const a = signedPolarAmplitude(s.j, s.m), b = signedPolarAmplitude(s.j2, s.m2)
  const integral = 2 * Math.PI * integrateGauss(u => a(u) * b(u) * (q === 0 ? u : -q * Math.sqrt(Math.max(0, 1 - u * u)) / Math.SQRT2), -1, 1, Math.max(64, s.j + s.j2 + 4))
  return Math.abs(integral) < 1e-12 ? 0 : integral
}

export function validateTransition(s: TransitionState & Pick<Settings, 'dipoleMoment'>) {
  const deltaJ = s.j2 - s.j, deltaM = s.m2 - s.m, q = polarizationOrder(s.polarization)
  const dipole = transitionDipole(s)
  const reason = !(s.dipoleMoment > 0) || !Number.isFinite(s.dipoleMoment) ? 'Electric-dipole transitions require a positive dipole moment.'
    : Math.abs(deltaJ) !== 1 ? `Forbidden: ΔJ = ${deltaJ}; electric-dipole rotation requires ΔJ = ±1.`
    : Math.abs(deltaM) > 1 ? `Forbidden: Δm = ${deltaM}; electric-dipole rotation requires Δm = 0, ±1.`
    : deltaM !== q ? `Forbidden: Δm = ${deltaM} requires ${POLARIZATIONS.find(option => option.q === deltaM)!.label}.`
    : dipole === 0 ? 'Forbidden: the angular transition dipole matrix element vanishes.' : ''
  return { allowed: !reason, reason, dipole, deltaJ, deltaM }
}

/** Ω is an effective positive angular frequency, rad/ps; φd is the phase of
 * H^I_fi = ℏΩ exp(iφd)/2, including the signed dipole and the minus in −μ·E.
 * The basis is Condon–Shortley, with no rephasing of its harmonics. */
export function rabiCoefficients(time: number, omega: number, phase: number, loop = false): WaveCoefficients {
  if (!(omega > 0) || !Number.isFinite(omega + time + phase)) throw new RangeError('Finite time/phase and positive Rabi frequency required')
  const progress = loop ? Math.max(0, time * omega / Math.PI) % 4 : time >= Math.PI / omega ? 1 : Math.max(0, time * omega / Math.PI)
  if (progress === 0) return initialCoefficients
  const sine = progress === 2 ? 0 : progress === 1 ? 1 : Math.sin(Math.PI * progress / 2)
  return { first: { re: progress === 1 || progress === 3 ? 0 : Math.cos(Math.PI * progress / 2), im: 0 }, second: { re: Math.sin(phase) * sine, im: -Math.cos(phase) * sine } }
}

export function laboratoryCoefficients(c: WaveCoefficients, firstPhase: number, secondPhase: number): WaveCoefficients {
  const rotate = (z: { re: number; im: number }, phase: number) => ({ re: z.re * Math.cos(phase) + z.im * Math.sin(phase), im: z.im * Math.cos(phase) - z.re * Math.sin(phase) })
  return { first: rotate(c.first, firstPhase), second: rotate(c.second, secondPhase) }
}

export function transitionRates(s: Settings) {
  const { inertia } = getMolecularParameters(s)
  const first = quantumQuantities(s.j, s.m, inertia).energy / HBAR
  const second = quantumQuantities(s.j2, s.m2, inertia).energy / HBAR
  const photonFrequency = Math.abs(second - first) / (2 * Math.PI)
  return { first, second, resonance: second - first, photonFrequency, photonWavelength: photonFrequency > 0 ? SPEED_OF_LIGHT / photonFrequency : Infinity }
}

/** Default Ω in rad/ps for the current resonant carrier. */
export const defaultRabiFrequency = (s: Settings) => Math.abs(transitionRates(s).resonance) / 1e13

/** Physical seconds per display second at the selected playback multiplier. */
export function transitionTimeScale(s: Settings) {
  return TRANSITION_TIME_SCALE * s.transitionPlayback
}

/** Real E/E0 at the molecule, k=+z for circular, k=+x for π.
 * For absorption σ+ rotates +x toward +y as seen from +z toward the origin;
 * σ− rotates oppositely. Operational Δm labels reverse helicity for stimulated
 * emission. Signed ω=(Ef−Ei)/ℏ handles that reversal consistently.
 * The field phase includes the real Cartesian-to-spherical coupling sign. */
export function electricField(s: TransitionState, signedOmega: number, time: number, drivePhase: number, dipole = transitionDipole(s)) {
  const q = polarizationOrder(s.polarization)
  const couplingSign = q === 0 ? -dipole : q * dipole
  const fieldPhase = drivePhase - (couplingSign < 0 ? Math.PI : 0)
  const angle = (signedOmega * time - fieldPhase) % (2 * Math.PI)
  return q === 0 ? { x: 0, y: 0, z: Math.cos(angle) } : { x: Math.cos(angle), y: q * Math.sin(angle), z: 0 }
}

/** Plane wave at a physical distance along k; returns E/E0 and cB/E0.
 * B = k-hat × E / c, with the origin matching the local driving field.
 * https://openstax.org/books/university-physics-volume-2/pages/16-2-plane-electromagnetic-waves */
export function electromagneticWave(s: TransitionState, signedOmega: number, time: number, drivePhase: number, distance = 0, dipole = transitionDipole(s)) {
  const electric = electricField(s, signedOmega, time - distance / SPEED_OF_LIGHT, drivePhase, dipole)
  const linear = s.polarization === 'pi'
  return {
    electric,
    magnetic: linear ? { x: 0, y: -electric.z, z: 0 } : { x: -electric.y, y: electric.x, z: 0 },
    direction: linear ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 },
  }
}

/** E0 in V/m required for the selected effective Ω; circular E has constant magnitude E0. */
export function drivingFieldAmplitude(s: Settings) {
  const validation = validateTransition(s)
  if (!validation.allowed) return 0
  const polarizationFactor = polarizationOrder(s.polarization) === 0 ? 1 : Math.SQRT2
  return HBAR * s.rabiFrequency * 1e12 / (s.dipoleMoment * DEBYE * Math.abs(validation.dipole) * polarizationFactor)
}

/** Laboratory-frame expectation in Debye, including the coherence's complex phase. */
export function dipoleExpectation(s: TransitionState & Pick<Settings, 'dipoleMoment'>, coefficients: WaveCoefficients, dipole = transitionDipole(s)) {
  const q = polarizationOrder(s.polarization), moments = densityMoments(coefficients)
  const scale = s.dipoleMoment * dipole
  return q === 0 ? { x: 0, y: 0, z: scale * moments.cosine }
    : { x: -q * scale * moments.cosine / Math.SQRT2, y: scale * moments.sine / Math.SQRT2, z: 0 }
}
