import { startTransition, useEffect, useRef, useState } from 'react'
import type { Settings } from '../types'
import { registerOrientationCDF } from '../physics/sampling'
import { unpackGeometry } from './geometry'
import { quantumKey, selectQuantumState, type PreparationRequest, type PreparationResult, type PreparedQuantumState } from './types'

export function useQuantumPreparation(settings: Settings) {
  const state = selectQuantumState(settings)
  const key = quantumKey(state)
  const desired = useRef<PreparationRequest>({ key, state })
  desired.current = { key, state }
  const controller = useRef<{ submit: (request: PreparationRequest) => void } | null>(null)
  const [prepared, setPrepared] = useState<PreparedQuantumState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    const worker = new Worker(new URL('./quantum.worker.ts', import.meta.url), { type: 'module' })
    let active = true, busy = false, queued: PreparationRequest | null = null
    const pump = () => {
      if (!active || busy || !queued) return
      const request = queued; queued = null; busy = true
      worker.postMessage(request)
    }
    controller.current = { submit(request) { queued = request; setError(null); pump() } }
    worker.onmessage = (event: MessageEvent<PreparationResult>) => {
      if (!active) return
      busy = false
      const data = event.data
      // Ignore superseded states; only the latest requested state is installed.
      if (data.key === desired.current.key) {
        if (data.error || !data.surface || !data.cdf || (data.state.superposition && (!data.secondCDF || !data.distribution))) setError(data.error ?? 'State preparation did not complete')
        else {
          registerOrientationCDF(data.state.j, data.state.m, data.cdf)
          if (data.secondCDF) registerOrientationCDF(data.state.j2, data.state.m2, data.secondCDF)
          const next: PreparedQuantumState = {
            key: data.key, state: data.state, surface: unpackGeometry(data.surface),
            overlay: data.overlay ? unpackGeometry(data.overlay) : undefined,
            distribution: data.distribution,
          }
          startTransition(() => { setPrepared(next); setError(null) })
        }
      }
      pump()
    }
    worker.onerror = event => { busy = false; if (active) setError(event.message || 'State preparation is unavailable') }
    return () => { active = false; controller.current = null; worker.terminate() }
  }, [epoch])

  useEffect(() => { controller.current?.submit(desired.current) }, [key, epoch])
  useEffect(() => () => {
    prepared?.surface.dispose(); prepared?.overlay?.dispose()
  }, [prepared])
  return { prepared, pending: prepared?.key !== key, error, retry: () => setEpoch(previous => previous + 1) }
}
