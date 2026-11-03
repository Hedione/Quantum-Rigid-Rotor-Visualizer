import * as THREE from 'three'
import type { SurfaceQuantity } from '../types'
import type { WaveCoefficients } from '../physics/superposition'

export interface WaveEvolutionData { m: number; m2: number; normalization: number; maxima: [number, number, number]; quantity: SurfaceQuantity; envelope?: { first: number[]; second: number[] } }

/** Cached complex fields and derivatives avoid recurrences, atan seam ambiguity,
 * and per-vertex trigonometric error. Each frame applies only complex rotations. */
export function attachEvolutionAttributes(geometry: THREE.BufferGeometry, directions: Float32Array, first: Float64Array, second: Float64Array, width: number, data: Omit<WaveEvolutionData, 'maxima'>) {
  const height = first.length - 1, step = Math.PI / height
  const polar = new Float32Array(directions.length / 3 * 4)
  const derivatives = new Float32Array(polar.length)
  const angles = Array.from({ length: width + 1 }, (_, col) => {
    const phi = (2 * Math.PI * col / width) % (2 * Math.PI) - Math.PI
    return [Math.cos(data.m * phi), Math.sin(data.m * phi), Math.cos(data.m2 * phi), Math.sin(data.m2 * phi)]
  })
  const derivative = (values: Float64Array, row: number) => row === 0 ? (-3 * values[0] + 4 * values[1] - values[2]) / (2 * step) : row === height ? (3 * values[row] - 4 * values[row - 1] + values[row - 2]) / (2 * step) : row >= 2 && row <= height - 2 ? (values[row - 2] - 8 * values[row - 1] + 8 * values[row + 1] - values[row + 2]) / (12 * step) : (values[row + 1] - values[row - 1]) / (2 * step)
  let magnitude = 0, joint = 0
  for (let row = 0; row <= height; row++) {
    const a = first[row], b = second[row], da = derivative(first, row), db = derivative(second, row)
    const envelope = (Math.abs(a) + Math.abs(b)) / data.normalization
    magnitude = Math.max(magnitude, envelope)
    joint = Math.max(joint, envelope * envelope * Math.sin(row * step))
    for (let col = 0; col <= width; col++) {
      const i = (row * (width + 1) + col) * 4
      const [c1, s1, c2, s2] = angles[col]
      polar[i] = a * c1; polar[i + 1] = a * s1; polar[i + 2] = b * c2; polar[i + 3] = b * s2
      derivatives[i] = da * c1; derivatives[i + 1] = da * s1; derivatives[i + 2] = db * c2; derivatives[i + 3] = db * s2
    }
  }
  geometry.setAttribute('waveDirection', new THREE.BufferAttribute(directions, 3))
  geometry.setAttribute('wavePolar', new THREE.BufferAttribute(polar, 4))
  geometry.setAttribute('waveDerivative', new THREE.BufferAttribute(derivatives, 4))
  geometry.userData.waveEvolution = { ...data, maxima: [magnitude, magnitude * magnitude, joint] } satisfies WaveEvolutionData
}

export const vertexEvolution = /* glsl */`
attribute vec3 waveDirection;
attribute vec4 wavePolar;
attribute vec4 waveDerivative;
uniform float waveEnabled;
uniform vec4 wavePhases;
uniform vec4 waveModes;
uniform vec3 waveMaxima;
uniform float wavePhaseColor;
uniform vec3 waveCyan;
uniform vec3 waveViolet;
struct WaveVertex { vec3 position; vec3 normal; vec3 color; };
vec4 rotateWave(vec4 v) {
  return vec4(v.x * wavePhases.x + v.y * wavePhases.y, v.y * wavePhases.x - v.x * wavePhases.y,
              v.z * wavePhases.z + v.w * wavePhases.w, v.w * wavePhases.z - v.z * wavePhases.w) / waveModes.z;
}
WaveVertex evolveWave() {
  vec3 n = normalize(waveDirection);
  float st = length(n.xy), ct = n.z;
  vec4 amplitudes = rotateWave(wavePolar), derivatives = rotateWave(waveDerivative);
  float re = amplitudes.x + amplitudes.z, im = amplitudes.y + amplitudes.w;
  vec2 dt = vec2(derivatives.x + derivatives.z, derivatives.y + derivatives.w);
  vec2 dp = vec2(-amplitudes.y * waveModes.x - amplitudes.w * waveModes.y, amplitudes.x * waveModes.x + amplitudes.z * waveModes.y);
  float probability = re * re + im * im;
  vec2 gradient = 2.0 * vec2(re * dt.x + im * dt.y, re * dp.x + im * dp.y);
  float magnitude = sqrt(probability), value = magnitude, maximum = waveMaxima.x;
  vec2 dr = value > 0.0000001 ? gradient / (2.0 * value) : vec2(0.0);
  float kind = waveModes.w;
  if (kind > 0.5 && kind < 2.5) {
    value = probability; dr = gradient; maximum = waveMaxima.y;
    if (kind > 1.5) { value *= st; dr = vec2(gradient.x * st + probability * ct, gradient.y * st); maximum = waveMaxima.z; }
  } else if (kind > 2.5) {
    float component = kind < 3.5 ? re : im;
    value = abs(component);
    dr = sign(component) * (kind < 3.5 ? vec2(dt.x, dp.x) : vec2(dt.y, dp.y));
  }
  float scale = maximum > 0.0000001 ? 1.9 / maximum : 0.0;
  vec2 azimuth = st > 0.000001 ? n.xy / st : vec2(1.0, 0.0);
  vec3 et = vec3(ct * azimuth, -st);
  vec3 ep = vec3(-azimuth.y, azimuth.x, 0.0);
  vec3 normal = value * st * n - dr.x * st * et - dr.y * ep;
  vec2 phase = wavePhaseColor > 0.5 && magnitude > 0.000001 ? vec2(re, im) / magnitude : vec2(kind > 2.5 && (kind < 3.5 ? re : im) < 0.0 ? -1.0 : 1.0, 0.0);
  if (kind > 0.5 && kind < 2.5) phase = vec2(1.0, 0.0);
  WaveVertex result;
  result.position = n * value * scale;
  result.normal = length(normal) > 0.0000001 ? normalize(normal) : n;
  result.color = clamp(mix(waveCyan, waveViolet, (1.0 - phase.x) * 0.5) + (wavePhaseColor > 0.5 ? phase.y * vec3(0.06, -0.02, 0.08) : vec3(0.0)), 0.0, 1.0);
  return result;
}
`

export function createSurfaceEvolution(materials: THREE.Material[]) {
  let data: WaveEvolutionData
  const uniforms = {
    waveEnabled: { value: 0 }, wavePhases: { value: new THREE.Vector4(1, 0, 1, 0) }, waveModes: { value: new THREE.Vector4() }, waveMaxima: { value: new THREE.Vector3() },
    wavePhaseColor: { value: 1 }, waveCyan: { value: new THREE.Color('#54dfca') }, waveViolet: { value: new THREE.Color('#a58bf4') },
  }
  for (const material of materials) {
    material.customProgramCacheKey = () => 'rigid-rotor-evolution-v2'
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${vertexEvolution}`)
        .replace('void main() {', 'void main() {\nWaveVertex animatedWave; if (waveEnabled > 0.5) animatedWave = evolveWave();')
        .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nif (waveEnabled > 0.5) vColor.xyz = animatedWave.color;\n#endif')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nif (waveEnabled > 0.5) objectNormal = animatedWave.normal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (waveEnabled > 0.5) transformed = animatedWave.position;')
    }
  }
  return {
    setGeometry(geometry: THREE.BufferGeometry) {
      data = geometry.userData.waveEvolution as WaveEvolutionData
      uniforms.waveModes.value.set(data.m, data.m2, data.normalization, ['magnitude', 'probability', 'jointProbability', 'real', 'imaginary'].indexOf(data.quantity))
      uniforms.waveMaxima.value.fromArray(data.maxima)
      uniforms.wavePhaseColor.value = Number(data.quantity === 'magnitude')
    },
    setPhases(first: number, second: number, enabled: boolean) { uniforms.waveEnabled.value = Number(enabled); uniforms.wavePhases.value.set(Math.cos(first), Math.sin(first), Math.cos(second), Math.sin(second)) },
    setCoefficients(c: WaveCoefficients, enabled: boolean) {
      uniforms.waveEnabled.value = Number(enabled)
      // rotateWave uses exp(-i phase); its cos/sin slots also carry magnitudes.
      uniforms.wavePhases.value.set(c.first.re, -c.first.im, c.second.re, -c.second.im)
      uniforms.waveModes.value.z = 1
      if (data.envelope) {
        let magnitude = 0, joint = 0
        const { first, second } = data.envelope, a = Math.hypot(c.first.re, c.first.im), b = Math.hypot(c.second.re, c.second.im)
        for (let row = 0; row < first.length; row++) {
          const value = data.m === data.m2 ? Math.hypot(first[row] * c.first.re + second[row] * c.second.re, first[row] * c.first.im + second[row] * c.second.im) : Math.abs(first[row]) * a + Math.abs(second[row]) * b
          magnitude = Math.max(magnitude, value)
          joint = Math.max(joint, value * value * Math.sin(row * Math.PI / (first.length - 1)))
        }
        uniforms.waveMaxima.value.set(magnitude, magnitude * magnitude, joint)
      }
    },
  }
}
