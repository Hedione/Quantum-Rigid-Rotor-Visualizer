import * as THREE from 'three'
import type { OrientationEnsemble } from './sampling'

const UP = new THREE.Vector3(0, 1, 0)
/** Rotor geometry uses the same magnification for bond lengths and displayed atom radii. */
export const ROTOR_DISPLAY_UNITS_PER_ANGSTROM = 3
export const ENSEMBLE_ATOM_RADIUS = 0.065
export const ENSEMBLE_ATOM_RADIUS_PM = ENSEMBLE_ATOM_RADIUS / ROTOR_DISPLAY_UNITS_PER_ANGSTROM * 100
export interface EnsembleMeshes { rods: THREE.InstancedMesh; atomsA: THREE.InstancedMesh; atomsB: THREE.InstancedMesh }

/** Shared production/test path writes the live GPU instance count and all transforms. */
export function updateEnsembleMeshes(engine: OrientationEnsemble, meshes: EnsembleMeshes, halfLength: number, object: THREE.Object3D, vector: THREE.Vector3, firstFraction = 0.5, atomScale = 1) {
  const firstDistance = 2 * halfLength * firstFraction
  const secondDistance = 2 * halfLength * (1 - firstFraction)
  for (let i = 0; i < engine.count; i++) {
    vector.fromArray(engine.orientations, i * 3).normalize()
    object.position.copy(vector).multiplyScalar((firstDistance - secondDistance) / 2)
    object.quaternion.setFromUnitVectors(UP, vector)
    object.scale.set(1, halfLength * 2, 1)
    object.updateMatrix()
    meshes.rods.setMatrixAt(i, object.matrix)
    object.scale.setScalar(atomScale)
    object.position.copy(vector).multiplyScalar(firstDistance)
    object.updateMatrix()
    meshes.atomsA.setMatrixAt(i, object.matrix)
    object.position.copy(vector).multiplyScalar(-secondDistance)
    object.updateMatrix()
    meshes.atomsB.setMatrixAt(i, object.matrix)
  }
  for (const mesh of Object.values(meshes)) {
    mesh.count = engine.count
    mesh.instanceMatrix.needsUpdate = true
  }
}
