import * as THREE from 'three'
import type { Vec3 } from '../physics/classical'

export const INITIAL_CAMERA: Vec3 = [4.4, -6.3, 3.7]
export const CAMERA_FOV = 40
const referenceDistance = Math.hypot(...INITIAL_CAMERA)
type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera
export interface CameraView { position: number[]; target: number[] }

export const orthographicViewZoom = (height: number, fit: number) => height / (2 * referenceDistance * Math.tan(CAMERA_FOV * Math.PI / 360) * fit)

/** Store an equivalent perspective distance so both projections share orbit, pan, and zoom. */
export function readCameraView(camera: Camera, target: THREE.Vector3, fit: number, baseZoom: number): CameraView {
  const zoom = camera instanceof THREE.OrthographicCamera ? camera.zoom / baseZoom : 1
  return { position: camera.position.clone().sub(target).divideScalar(fit * zoom).add(target).toArray(), target: target.toArray() }
}

export function applyCameraView(camera: Camera, view: CameraView, fit: number, baseZoom: number, size: { width: number; height: number }) {
  const target = new THREE.Vector3().fromArray(view.target)
  const offset = new THREE.Vector3().fromArray(view.position).sub(target)
  if (camera instanceof THREE.OrthographicCamera) {
    camera.left = -size.width / 2; camera.right = size.width / 2
    camera.top = size.height / 2; camera.bottom = -size.height / 2
    camera.zoom = baseZoom * referenceDistance / offset.length()
    offset.setLength(referenceDistance)
  } else camera.aspect = size.width / size.height
  camera.position.copy(offset.multiplyScalar(fit).add(target))
  camera.updateProjectionMatrix()
}
