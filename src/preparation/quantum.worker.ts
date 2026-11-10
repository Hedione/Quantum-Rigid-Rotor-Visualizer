import { createWavefunctionGeometry } from '../rendering/wavefunction'
import { copyOrientationCDF } from '../physics/sampling'
import { prepareSuperpositionDistribution } from '../physics/superposition'
import { packGeometry } from './geometry'
import type { PackedGeometry, PreparationRequest, PreparationResult } from './types'
import { MAX_HISTOGRAM_BINS } from '../physics/histograms'

self.onmessage = (event: MessageEvent<PreparationRequest>) => {
  const { key, state } = event.data
  try {
    const result: PreparationResult = { key, state, cdf: copyOrientationCDF(state.j, state.m) }
    if (state.superposition) {
      result.secondCDF = copyOrientationCDF(state.j2, state.m2)
      result.distribution = prepareSuperpositionDistribution(state, MAX_HISTOGRAM_BINS)
    }
    const surface = createWavefunctionGeometry(state)
    result.surface = packGeometry(surface); surface.dispose()
    if (state.overlay) { const overlay = createWavefunctionGeometry(state, true); result.overlay = packGeometry(overlay); overlay.dispose() }
    const transfer: Transferable[] = []
    for (const geometry of [result.surface, result.overlay] as (PackedGeometry | undefined)[]) {
      if (geometry) for (const array of [geometry.position, geometry.normal, geometry.color, geometry.index]) if (array) transfer.push(array.buffer as ArrayBuffer)
      if (geometry?.wave) transfer.push(geometry.wave.polar.buffer as ArrayBuffer, geometry.wave.derivative.buffer as ArrayBuffer, geometry.wave.direction.buffer as ArrayBuffer)
    }
    for (const table of [result.cdf, result.secondCDF]) if (table) for (const array of [table.cdf, table.left, table.right]) if (array) transfer.push(array.buffer as ArrayBuffer)
    self.postMessage(result, { transfer })
  } catch (error) { self.postMessage({ key, state, error: error instanceof Error ? error.message : String(error) } satisfies PreparationResult) }
}
