import type * as THREE from 'three'
import type { Settings } from '../types'
import type { PackedCDF } from '../physics/sampling'
import type { DistributionTheory } from '../physics/superposition'
import type { WaveEvolutionData } from '../rendering/evolving-surface'

export type QuantumState = Pick<Settings, 'j' | 'm' | 'superposition' | 'j2' | 'm2' | 'surfaceQuantity' | 'phaseColor' | 'nodes' | 'overlay'>
export const selectQuantumState = (s: Settings): QuantumState => ({ j: s.j, m: s.m, superposition: s.superposition, j2: s.j2, m2: s.m2, surfaceQuantity: s.surfaceQuantity, phaseColor: s.phaseColor, nodes: s.nodes, overlay: s.overlay })
export interface PackedGeometry {
  position: Float32Array; normal?: Float32Array; color?: Float32Array;
  index?: Uint16Array | Uint32Array; center: [number, number, number]; radius: number;
  wave?: { polar: Float32Array; derivative: Float32Array; direction: Float32Array; data: WaveEvolutionData }
}
export interface PreparationRequest { key: string; state: QuantumState }
export interface PreparationResult extends PreparationRequest {
  surface?: PackedGeometry; overlay?: PackedGeometry; nodes?: PackedGeometry; cdf?: PackedCDF; secondCDF?: PackedCDF; distribution?: DistributionTheory; error?: string;
}
export interface PreparedQuantumState {
  key: string; state: QuantumState; surface: THREE.BufferGeometry; overlay?: THREE.BufferGeometry; nodes?: THREE.BufferGeometry; distribution?: DistributionTheory;
}
export const quantumKey = (s: QuantumState) => JSON.stringify([s.j, s.m, s.superposition, s.superposition ? s.j2 : 0, s.superposition ? s.m2 : 0, s.surfaceQuantity, s.phaseColor, s.nodes, s.overlay])
