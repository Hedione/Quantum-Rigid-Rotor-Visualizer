import type { Settings } from '../types'
import { molecularParameters } from './quantum'

export type MolecularSettings = Pick<Settings, 'atomMass' | 'atomMass2' | 'asymmetricBond' | 'bondLength'>

/** Rounded educational models; bond lengths follow NIST CCCBDB experimental values.
 * https://cccbdb.nist.gov/bondlengthmodel2x.asp?basis=25&method=63
 */
export const MOLECULE_PRESETS = [
  { name: 'Hydrogen', formula: 'H₂', atomMass: 1, atomMass2: 1, asymmetricBond: false, bondLength: 0.74, dipoleMoment: 0 },
  { name: 'Hydrogen deuteride', formula: 'HD', atomMass: 1, atomMass2: 2, asymmetricBond: true, bondLength: 0.74, dipoleMoment: 0.00083 },
  { name: 'Hydrogen fluoride', formula: 'HF', atomMass: 1, atomMass2: 19, asymmetricBond: true, bondLength: 0.92, dipoleMoment: 1.827 },
  { name: 'Carbon monoxide', formula: 'CO', atomMass: 12, atomMass2: 16, asymmetricBond: true, bondLength: 1.13, dipoleMoment: 0.112 },
] as const

// Dipoles: NIST CCCBDB diplistx.asp; HD ≈8.3e−4 D: Maio et al., arXiv:0704.2182, p. 1.
export const DEBYE = 3.33564e-30
export const MAX_DIPOLE_MOMENT = 10
export const MIN_TRANSITION_DIPOLE_MOMENT = 0.00001

export function matchesMoleculePreset(settings: Settings, preset: (typeof MOLECULE_PRESETS)[number]) {
  return settings.atomMass === preset.atomMass && getMolecularParameters(settings).mass2 === preset.atomMass2 && settings.bondLength === preset.bondLength && settings.asymmetricBond === preset.asymmetricBond && settings.dipoleMoment === preset.dipoleMoment
}

/** Match particle 1 is ON when asymmetricBond is false; otherwise mass 2 is independent. */
export function getMolecularParameters(settings: MolecularSettings) {
  const mass1 = settings.atomMass
  const mass2 = settings.asymmetricBond ? settings.atomMass2 : mass1
  return { ...molecularParameters(mass1, settings.bondLength, mass2), mass1, mass2 }
}
