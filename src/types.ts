export type SceneKind = 'wavefunction' | 'ensemble' | 'classical'
export type SurfaceQuantity = 'magnitude' | 'probability' | 'jointProbability' | 'real' | 'imaginary'
export interface Settings {
  highJ: boolean; followStretched: boolean;
  j: number; m: number; count: number; frequency: number; histogramFrequency: number; rotorOpacity: number;
  superposition: boolean; j2: number; m2: number; timeEvolution: boolean; quantumPlayback: number;
  seed: number; ensemblePaused: boolean; regenerate: number; resetStats: number;
  atomMass: number; bondLength: number; playback: number;
  zAxis: boolean; nodes: boolean; phaseColor: boolean;
  surfaceQuantity: SurfaceQuantity; overlay: boolean;
  cameraReset: number; syncCameras: boolean;
}
export const defaultSettings: Settings = {
  highJ: false, followStretched: false,
  j: 1, m: 0, count: 2000, frequency: 30, histogramFrequency: 30, rotorOpacity: 0.05,
  superposition: false, j2: 2, m2: 1, timeEvolution: false, quantumPlayback: 1,
  seed: 42, ensemblePaused: false, regenerate: 0, resetStats: 0,
  atomMass: 1, bondLength: 0.74, playback: 1,
  zAxis: true, nodes: false, phaseColor: true,
  surfaceQuantity: 'jointProbability', overlay: false,
  cameraReset: 0, syncCameras: true,
}
