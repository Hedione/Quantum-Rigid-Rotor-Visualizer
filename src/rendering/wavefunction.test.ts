import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWavefunctionGeometry } from './wavefunction'

describe('wavefunction surface orientation', () => {
  it.each([[150, 150], [200, 100], [200, 200]])('builds finite, resolved high-J geometry for J=%i, m=%i', (j, m) => {
    const geometry = createWavefunctionGeometry({ j, m, surfaceQuantity: 'real', phaseColor: true })
    for (const attribute of ['position', 'normal', 'color']) expect(geometry.getAttribute(attribute).array.every(Number.isFinite)).toBe(true)
    expect(geometry.boundingSphere!.radius).toBeGreaterThan(1)
    expect(geometry.boundingSphere!.radius).toBeLessThan(2.01)
    expect(geometry.getAttribute('position').count).toBeGreaterThan(25000)
    geometry.dispose()
  })
  it.each([[1, 0], [2, 1], [10, 5]])('preserves outward triangle winding for J=%i, m=%i', (j, m) => {
    const geometry = createWavefunctionGeometry({ j, m, surfaceQuantity: 'magnitude', phaseColor: true })
    const positions = geometry.attributes.position, indices = geometry.index!
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), normal = new THREE.Vector3(), center = new THREE.Vector3()
    let outward = 0, inward = 0
    for (let i = 0; i < indices.count; i += 3) {
      a.fromBufferAttribute(positions, indices.getX(i)); b.fromBufferAttribute(positions, indices.getX(i + 1)); c.fromBufferAttribute(positions, indices.getX(i + 2))
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a))
      center.copy(a).add(b).add(c).divideScalar(3)
      const radialNormal = normal.dot(center)
      if (radialNormal > 1e-12) outward++
      if (radialNormal < -1e-12) inward++
    }
    expect(outward).toBeGreaterThan(1000)
    expect(inward).toBe(0)
    geometry.dispose()
  })
})
