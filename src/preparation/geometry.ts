import * as THREE from 'three'
import type { PackedGeometry } from './types'

export function packGeometry(geometry: THREE.BufferGeometry): PackedGeometry {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  return {
    position: geometry.getAttribute('position').array as Float32Array,
    normal: geometry.getAttribute('normal')?.array as Float32Array | undefined,
    color: geometry.getAttribute('color')?.array as Float32Array | undefined,
    index: geometry.index?.array as Uint16Array | Uint32Array | undefined,
    center: geometry.boundingSphere!.center.toArray(), radius: geometry.boundingSphere!.radius,
    wave: geometry.hasAttribute('wavePolar') ? { polar: geometry.getAttribute('wavePolar').array as Float32Array, derivative: geometry.getAttribute('waveDerivative').array as Float32Array, direction: geometry.getAttribute('waveDirection').array as Float32Array, data: geometry.userData.waveEvolution } : undefined,
  }
}
export function unpackGeometry(packed: PackedGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(packed.position, 3))
  if (packed.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(packed.normal, 3))
  if (packed.color) geometry.setAttribute('color', new THREE.BufferAttribute(packed.color, 3))
  if (packed.index) geometry.setIndex(new THREE.BufferAttribute(packed.index, 1))
  if (packed.wave) {
    geometry.setAttribute('wavePolar', new THREE.BufferAttribute(packed.wave.polar, 4))
    geometry.setAttribute('waveDerivative', new THREE.BufferAttribute(packed.wave.derivative, 4))
    geometry.setAttribute('waveDirection', new THREE.BufferAttribute(packed.wave.direction, 3))
    geometry.userData.waveEvolution = packed.wave.data
  }
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...packed.center), packed.radius)
  return geometry
}
