import type { Settings } from '../types'
import { molecularParameters } from './quantum'

export type MolecularSettings = Pick<Settings, 'atomMass' | 'atomMass2' | 'asymmetricBond' | 'bondLength'>

/** Rounded educational models; bond lengths follow NIST CCCBDB experimental values.
 * https://cccbdb.nist.gov/bondlengthmodel2x.asp?basis=25&method=63
 */
export const MOLECULE_PRESETS = [
  { name: 'Hydrogen', formula: 'H₂', atomMass: 1, atomMass2: 1, asymmetricBond: false, bondLength: 0.74 },
  { name: 'Hydrogen deuteride', formula: 'HD', atomMass: 1, atomMass2: 2, asymmetricBond: true, bondLength: 0.74 },
  { name: 'Nitrogen', formula: 'N₂', atomMass: 14, atomMass2: 14, asymmetricBond: false, bondLength: 1.10 },
  { name: 'Carbon monoxide', formula: 'CO', atomMass: 12, atomMass2: 16, asymmetricBond: true, bondLength: 1.13 },
] as const

/** Match particle 1 is ON when asymmetricBond is false; otherwise mass 2 is independent. */
export function getMolecularParameters(settings: MolecularSettings) {
  const mass1 = settings.atomMass
  const mass2 = settings.asymmetricBond ? settings.atomMass2 : mass1
  return { ...molecularParameters(mass1, settings.bondLength, mass2), mass1, mass2 }
}
