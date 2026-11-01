import { useMemo, useState, useSyncExternalStore } from 'react'
import { ChartNoAxesColumn, RotateCcw } from 'lucide-react'
import { polarAngleDensity, polarDensity } from '../physics/quantum'
import { HISTOGRAM_BINS, polarBinDensities, thetaBinDensities, type SampleStatistics } from '../physics/sampling'
import { distributionAtPhase, type DistributionTheory } from '../physics/superposition'
import { HISTOGRAM_BIN_OPTIONS, DIAGNOSTICS_HZ, rebinCounts, rebinDensities } from '../physics/histograms'
import type { StatisticsStore } from '../store/statistics'
import { Range } from './UI'
import { defaultSettings } from '../types'

function DistributionChart({ title, description, theory, bins, domain, ticks, axis, formula, className }: {
  title: string; description: string; theory: number[]; bins: number[]; domain: [number, number];
  ticks: { value: number; label: string }[]; axis: string; formula: string; className: string;
}) {
  const total = bins.reduce((a, b) => a + b, 0)
  const densities = bins.map(n => total > 0 ? n / total / ((domain[1] - domain[0]) / bins.length) : 0)
  const maxY = Math.max(...theory, ...densities) * 1.2
  const W = 440, H = 140, left = 35, right = 16, top = 10, bottom = 36
  const width = W - left - right, height = H - top - bottom
  const barWidth = width / bins.length, barGap = Math.min(2, barWidth * 0.15)
  const line = theory.map((p, i) => `${i ? 'L' : 'M'}${(left + i / (theory.length - 1) * width).toFixed(2)},${(top + height - p / maxY * height).toFixed(2)}`).join(' ')
  return <div className={`distribution-chart ${className}`}>
    <h3>{title}</h3>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} data-bin-count={bins.length} data-theory-min={Math.min(...theory)} data-theory-max={Math.max(...theory)}>
      {[0, 0.5, 1].map(t => <g key={t}><line x1={left} x2={W - right} y1={top + height * t} y2={top + height * t} stroke="#263443" strokeDasharray="3 4" /><text x={left - 7} y={top + height * t + 3} textAnchor="end">{(maxY * (1 - t)).toFixed(2)}</text></g>)}
      {densities.map((d, i) => <rect key={i} x={left + i * barWidth + barGap / 2} y={top + height - d / maxY * height} width={barWidth - barGap} height={d / maxY * height} rx={Math.min(1, barWidth / 4)} fill="#6677bc" opacity="0.48" />)}
      <path d={line} fill="none" stroke="#6edbc8" strokeWidth="2" />
      {ticks.map(tick => <text key={tick.value} x={left + (tick.value - domain[0]) / (domain[1] - domain[0]) * width} y={H - 20} textAnchor="middle">{tick.label}</text>)}
      <text x={left + width / 2} y={H - 4} textAnchor="middle">{axis}</text>
    </svg>
    <p>{formula}</p>
  </div>
}

type DiagnosticsProps = { j: number; m: number; stats: SampleStatistics; onReset: () => void; distribution?: DistributionTheory; evolving?: boolean; frequency: number; onFrequencyChange: (value: number) => void }
const stepCurve = (values: number[]) => {
  const points = Math.max(401, values.length * 2 + 1)
  return Array.from({ length: points }, (_, i) => values[Math.min(values.length - 1, Math.floor(i / (points - 1) * values.length))])
}

export function LiveDiagnostics({ store, ...props }: Omit<DiagnosticsProps, 'stats'> & { store: StatisticsStore }) {
  const stats = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return <Diagnostics {...props} stats={stats} />
}

export function Diagnostics({ j, m, stats, onReset, distribution: preparedDistribution, evolving = false, frequency, onFrequencyChange }: DiagnosticsProps) {
  const [cumulative, setCumulative] = useState(false)
  const [solidAngle, setSolidAngle] = useState(false)
  const [binCount, setBinCount] = useState(HISTOGRAM_BINS)
  const phase = stats.relativePhase ?? 0
  const distribution = useMemo(() => preparedDistribution && evolving ? distributionAtPhase(preparedDistribution, cumulative ? stats.meanPhaseCosine ?? 1 : Math.cos(phase), cumulative ? stats.meanPhaseSine ?? 0 : Math.sin(phase)) : preparedDistribution, [preparedDistribution, evolving, cumulative, phase, stats.meanPhaseCosine, stats.meanPhaseSine])
  const theory = useMemo(() => {
    if (distribution) {
      return stepCurve(rebinDensities(solidAngle ? distribution.theta : distribution.polar, binCount))
    }
    if (j <= 20) return Array.from({ length: 201 }, (_, i) => solidAngle ? polarAngleDensity(j, m, i * Math.PI / 200) : polarDensity(j, m, -1 + i / 100))
    return stepCurve(solidAngle ? thetaBinDensities(j, m, binCount) : polarBinDensities(j, m, binCount))
  }, [j, m, solidAngle, distribution, binCount])
  const azimuthBinned = Boolean(distribution && (distribution.azimuthBinned || (distribution.azimuthOrder ?? 0) > binCount / 2))
  const azimuthTheory = useMemo(() => distribution && azimuthBinned && distribution.azimuthBins ? stepCurve(rebinDensities(distribution.azimuthBins, binCount)) : distribution?.azimuth ?? [1 / (2 * Math.PI), 1 / (2 * Math.PI)], [distribution, azimuthBinned, binCount])
  const polarHistogram = useMemo(() => rebinCounts(cumulative ? solidAngle ? stats.thetaHistogram : stats.histogram : solidAngle ? stats.currentThetaHistogram : stats.currentHistogram, binCount), [stats, cumulative, solidAngle, binCount])
  const azimuthHistogram = useMemo(() => rebinCounts(cumulative ? stats.azimuthHistogram : stats.currentAzimuthHistogram, binCount), [stats, cumulative, binCount])
  return <section className="diagnostics" aria-label="Orientation distribution diagnostics" data-update-hz={frequency}>
    <div className="diagnostics-heading"><div><ChartNoAxesColumn size={15} /><span>ORIENTATION DISTRIBUTIONS</span></div><div className="chart-legend"><span><i className="theory-line" /> {distribution ? 'Coherent theory (polar bin average)' : j > 20 ? 'Theory (polar bin average)' : 'Theory'}</span><span><i className="sample-block" /> Samples</span></div></div>
    <div className="distribution-charts">
      <div className="polar-distribution-controls">
        <div className="distribution-view-control" role="group" aria-label="Polar probability view">
          <button className={solidAngle ? 'chip' : 'chip active'} aria-pressed={!solidAngle} onClick={() => setSolidAngle(false)}>Density vs cos θ</button>
          <button className={solidAngle ? 'chip active' : 'chip'} aria-pressed={solidAngle} onClick={() => setSolidAngle(true)}>Solid-angle probability</button>
        </div>
        {solidAngle && <p className="probability-explanation">Azimuth is integrated out and sin θ is included. The area under the polar-angle curve is 1; the ensemble already uses this weighting.</p>}
      </div>
      {solidAngle ? <DistributionChart className="polar-chart" title="POLAR · SOLID ANGLE INCLUDED" description="Solid-angle integrated polar probability per theta: theory and sampled histogram" theory={theory} bins={polarHistogram} domain={[0, Math.PI]} ticks={[{ value: 0, label: '0' }, { value: Math.PI / 2, label: 'π/2' }, { value: Math.PI, label: 'π' }]} axis="θ (rad)" formula={distribution ? 'p(θ) = sin θ ∫ |ψ(θ,φ)|² dφ' : 'p(θ) = ∫ |Y(θ,φ)|² sin θ dφ = 2π |Y|² sin θ'} /> : <DistributionChart className="polar-chart" title="POLAR" description="Polar orientation probability density of cos theta: theory and sampled histogram" theory={theory} bins={polarHistogram} domain={[-1, 1]} ticks={[-1, 0, 1].map(u => ({ value: u, label: String(u) }))} axis="cos θ" formula={distribution ? 'p(u) = ∫ |ψ(acos u,φ)|² dφ' : 'p(u) = 2π |Y(acos u, φ)|²'} />}
      <DistributionChart className="azimuthal-chart" title="AZIMUTHAL" description={distribution ? 'Azimuthal superposition probability density of phi: coherent theory and sampled histogram' : 'Azimuthal orientation probability density of phi: uniform theory and sampled histogram'} theory={azimuthTheory} bins={azimuthHistogram} domain={[0, 2 * Math.PI]} ticks={[{ value: 0, label: '0' }, { value: Math.PI, label: 'π' }, { value: 2 * Math.PI, label: '2π' }]} axis="φ (rad)" formula={distribution ? `p(φ) = ∫ |ψ(acos u,φ)|² du · ${azimuthBinned ? 'bin averaged' : 'includes interference'}` : 'p(φ) = 1/(2π) · uniform for every eigenstate'} />
    </div>
    <div className="diagnostics-footer">
      <div className="diagnostics-footer-range histogram-bin-control"><Range label="Histogram bins" value={binCount} resetValue={HISTOGRAM_BINS} min={HISTOGRAM_BIN_OPTIONS[0]} max={HISTOGRAM_BIN_OPTIONS[HISTOGRAM_BIN_OPTIONS.length - 1]} options={HISTOGRAM_BIN_OPTIONS} display={`${binCount} bins`} onChange={setBinCount} /></div>
      <div className="diagnostics-footer-actions"><button className={cumulative ? 'chip active' : 'chip'} aria-pressed={cumulative} onClick={() => setCumulative(!cumulative)}>{cumulative ? 'Cumulative' : 'Current batch'}</button><button className="icon-button" aria-label="Reset cumulative statistics" title="Reset cumulative statistics" onClick={onReset}><RotateCcw size={17} /></button></div>
      <div className="diagnostics-footer-range histogram-rate-control"><Range label="Histogram sampling rate" value={frequency} resetValue={defaultSettings.histogramFrequency} min={1} max={DIAGNOSTICS_HZ} suffix="Hz" onChange={onFrequencyChange} /></div>
      <span className="diagnostics-sample-summary"><strong data-testid="cumulative-samples">{stats.total.toLocaleString()}</strong> cumulative samples<small>One recorded bond direction contributes to both charts.</small></span>
    </div>
  </section>
}
