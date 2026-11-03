export type SceneKind = 'wavefunction' | 'ensemble' | 'classical'
export type SurfaceQuantity = 'magnitude' | 'probability' | 'jointProbability' | 'real' | 'imaginary'
export type RotorPalette = 'greenViolet' | 'blueOrange' | 'mint'
export type Polarization = 'pi' | 'sigmaPlus' | 'sigmaMinus'
export const surfaceColorMode = (quantity: SurfaceQuantity) => quantity === 'magnitude' ? 'phase' : quantity === 'real' || quantity === 'imaginary' ? 'sign' : 'density'
export interface Settings {
  highJ: boolean;
  j: number; m: number; count: number; frequency: number; histogramFrequency: number; rotorOpacity: number;
  superposition: boolean; j2: number; m2: number; timeEvolution: boolean; quantumPlayback: number;
  coherentTransition: boolean; polarization: Polarization; rabiFrequency: number; drivePhase: number;
  transitionPlaying: boolean; transitionProgress: number; transitionRun: number; transitionPlayback: number;
  seed: number; ensemblePaused: boolean; regenerate: number; resetStats: number;
  atomMass: number; atomMass2: number; asymmetricBond: boolean; bondLength: number; playback: number;
  rotorPalette: RotorPalette; particleOcclusion: boolean; ensembleAtomRadius: number;
  nodes: boolean;
  surfaceQuantity: SurfaceQuantity; overlay: boolean;
  cameraReset: number;
}
export const defaultSettings: Settings = {
  highJ: false,
  j: 1, m: 0, count: 2500, frequency: 30, histogramFrequency: 10, rotorOpacity: 0.01,
  superposition: false, j2: 2, m2: 1, timeEvolution: true, quantumPlayback: 1,
  coherentTransition: false, polarization: 'sigmaMinus', rabiFrequency: Math.PI, drivePhase: 0,
  transitionPlaying: false, transitionProgress: 0, transitionRun: 0, transitionPlayback: 10,
  seed: 42, ensemblePaused: false, regenerate: 0, resetStats: 0,
  atomMass: 1, atomMass2: 1, asymmetricBond: false, bondLength: 0.74, playback: 1,
  rotorPalette: 'greenViolet', particleOcclusion: false, ensembleAtomRadius: 5,
  nodes: false,
  surfaceQuantity: 'jointProbability', overlay: false,
  cameraReset: 0,
}
