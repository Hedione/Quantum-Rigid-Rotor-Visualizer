import * as THREE from 'three'
import type { RotorPalette } from '../types'
import type { EnsembleMeshes } from '../physics/instancing'

export const ROTOR_PALETTES: Record<RotorPalette, { label: string; first: string; second: string; bond: string }> = {
  greenViolet: { label: 'Green / violet', first: '#00f58a', second: '#aa28ff', bond: '#286d5d' },
  cyanCoral: { label: 'Cyan / coral', first: '#00ddff', second: '#ff685e', bond: '#347e91' },
  mint: { label: 'Single mint', first: '#54dfca', second: '#54dfca', bond: '#286d5d' },
}

/** A shared depth pass resolves the nearest particle independently of instance/draw order. */
export function createParticleDepthPass(meshes: EnsembleMeshes) {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true })
  const pairs = Object.values(meshes).map(source => {
    const depth = new THREE.InstancedMesh(source.geometry, material, 0)
    // Share CPU transform data, but own a distinct GPU attribute. Disposing an
    // InstancedMesh deletes its attribute's GPU buffer, including cached VAOs.
    depth.instanceMatrix = new THREE.InstancedBufferAttribute(source.instanceMatrix.array, 16).setUsage(THREE.DynamicDrawUsage)
    depth.name = 'particle-occlusion-depth'
    depth.frustumCulled = false
    depth.renderOrder = -10
    group.add(depth)
    return { source, depth, version: -1 }
  })
  const sync = () => {
    for (const pair of pairs) {
      const { source, depth } = pair
      if (pair.version !== source.instanceMatrix.version) {
        depth.instanceMatrix.needsUpdate = true
        pair.version = source.instanceMatrix.version
      }
      depth.count = source.count
    }
  }
  sync()
  return { group, sync, dispose: () => {
    for (const { depth } of pairs) depth.dispose()
    group.clear()
    material.dispose()
  } }
}
