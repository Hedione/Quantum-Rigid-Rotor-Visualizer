import type { SampleStatistics } from '../physics/sampling'

/** Only the chart subscribes, so 60 Hz statistics do not rerender the experiment. */
export function createStatisticsStore(initial: SampleStatistics) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    publish: (next: SampleStatistics) => { snapshot = next; for (const listener of listeners) listener() },
  }
}
export type StatisticsStore = ReturnType<typeof createStatisticsStore>
