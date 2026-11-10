import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyCameraView, orthographicViewZoom, readCameraView } from './camera'

describe('field camera projection', () => {
  it.each([1, -1])('keeps the projected helix radius constant looking along z = %s', sign => {
    const camera = new THREE.OrthographicCamera()
    const size = { width: 600, height: 400 }, baseZoom = orthographicViewZoom(size.height, 1)
    applyCameraView(camera, { position: [0, 0, sign * 10], target: [0, 0, 0] }, 1, baseZoom, size)
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
    const radii = Array.from({ length: 161 }, (_, i) => {
      const z = (i / 160 * 2 - 1) * 2.5, angle = z * 2 * Math.PI / 3
      const point = new THREE.Vector3(2.2 * Math.cos(angle), 2.2 * Math.sin(angle), z).project(camera)
      return Math.hypot(point.x * size.width / 2, point.y * size.height / 2)
    })
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-12)
    expect(radii[0]).toBeCloseTo(baseZoom * Math.hypot(4.4, -6.3, 3.7) / 10 * 2.2, 10)
  })
  it('round-trips synchronized views through perspective and orthographic cameras at different sizes', () => {
    for (const fit of [1, 1.2, 3]) for (const distance of [3.2, 8, 16]) {
      const view = { position: [distance, -distance / 2, distance / 3], target: [0.3, -0.2, 0.1] }
      for (const camera of [new THREE.PerspectiveCamera(), new THREE.OrthographicCamera()]) {
        const zoom = orthographicViewZoom(430, fit)
        applyCameraView(camera, view, fit, zoom, { width: 600, height: 430 })
        const restored = readCameraView(camera, new THREE.Vector3().fromArray(view.target), fit, zoom)
        restored.position.forEach((value, index) => expect(value).toBeCloseTo(view.position[index], 12))
        expect(restored.target).toEqual(view.target)
      }
    }
  })
})
