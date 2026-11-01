import * as THREE from 'three'
import { polarNodeRoots } from '../physics/quantum'
import type { Vec3 } from '../physics/classical'
import type { Settings } from '../types'

export function createNodeGeometry(settings: Pick<Settings, 'j' | 'm' | 'surfaceQuantity'>) {
    const points: number[] = [], r = 2.1
    const segment = (a: Vec3, b: Vec3) => { points.push(...a, ...b) }
    for (const u of polarNodeRoots(settings.j, settings.m)) {
      const radius = r * Math.sqrt(1 - u * u)
      const at = (angle: number): Vec3 => [radius * Math.cos(angle), radius * Math.sin(angle), r * u]
      for (let i = 0; i < 96; i++) segment(at(i * Math.PI / 48), at((i + 1) * Math.PI / 48))
      for (let i = 0; i < 12; i++) segment([0, 0, 0], at(i * Math.PI / 6))
    }
    if (Math.abs(settings.m) > 0) segment([0, 0, -r], [0, 0, r])
    if (settings.surfaceQuantity === 'real' || settings.surfaceQuantity === 'imaginary') {
      const a = Math.abs(settings.m)
      for (let i = 0; i < a; i++) {
        const angle = (i * Math.PI + (settings.surfaceQuantity === 'real' ? Math.PI / 2 : 0)) / a
        const x = r * Math.cos(angle), y = r * Math.sin(angle)
        const corners: Vec3[] = [[x, y, r], [-x, -y, r], [-x, -y, -r], [x, y, -r]]
        for (let edge = 0; edge < 4; edge++) segment(corners[edge], corners[(edge + 1) % 4])
      }
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
}
