import * as THREE from 'three'
import type { OrientationEnsemble } from './sampling'

const UP = new THREE.Vector3(0, 1, 0)
export interface EnsembleMeshes { rods: THREE.InstancedMesh; atomsA: THREE.InstancedMesh; atomsB: THREE.InstancedMesh }

/** Shared production/test path writes the live GPU instance count and all transforms. */
export function updateEnsembleMeshes(engine: OrientationEnsemble, meshes: EnsembleMeshes, halfLength: number, object: THREE.Object3D, vector: THREE.Vector3) {
  for (let i = 0; i < engine.count; i++) {
    vector.fromArray(engine.orientations, i * 3).normalize()
    object.position.set(0, 0, 0)
    object.quaternion.setFromUnitVectors(UP, vector)
    object.scale.set(1, halfLength * 2, 1)
    object.updateMatrix()
    meshes.rods.setMatrixAt(i, object.matrix)
    object.scale.setScalar(1)
    object.position.copy(vector).multiplyScalar(halfLength)
    object.updateMatrix()
    meshes.atomsA.setMatrixAt(i, object.matrix)
    object.position.multiplyScalar(-1)
    object.updateMatrix()
    meshes.atomsB.setMatrixAt(i, object.matrix)
  }
  for (const mesh of Object.values(meshes)) {
    mesh.count = engine.count
    mesh.instanceMatrix.needsUpdate = true
  }
}
