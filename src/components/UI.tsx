import katex from 'katex'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { logPosition, logValue } from '../physics/scales'

export function MathText({ children, block = false }: { children: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(children, { throwOnError: false, displayMode: block, output: 'html' }), [children, block])
  return <span className={block ? 'math-block' : 'math'} role="math" aria-label={children} dangerouslySetInnerHTML={{ __html: html }} />
}

export function Toggle({ label, checked, onChange, hint, ariaLabel, controls, eyebrow }: { label: ReactNode; checked: boolean; onChange: (value: boolean) => void; hint?: ReactNode; ariaLabel?: string; controls?: string; eyebrow?: string }) {
  const hintId = useId()
  return <button type="button" className="toggle-button" aria-pressed={checked} aria-expanded={controls ? checked : undefined} aria-controls={controls} aria-describedby={hint ? hintId : undefined} aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)} onClick={() => onChange(!checked)}>
    <span className="toggle-title">{eyebrow && <span className="section-number">{eyebrow}</span>}<span className="toggle-label">{label}</span><span className="toggle-state" aria-hidden="true">{checked ? 'ON' : 'OFF'}</span></span>
    {hint && <span className="toggle-hint" id={hintId}>{hint}</span>}
  </button>
}

export function Range({ label, value, resetValue, min, max, step = 1, onChange, display, suffix, input = false, disabled = false, logarithmic, minLabel, maxLabel, hideLabel = false, options, hint, companion }: {
  label: string; value: number; resetValue: number; min: number; max: number; step?: number;
  onChange: (value: number) => void; display?: string; suffix?: string; input?: boolean; disabled?: boolean;
  logarithmic?: boolean; minLabel?: string; maxLabel?: string; hideLabel?: boolean;
  options?: readonly number[]; hint?: ReactNode; companion?: ReactNode;
}) {
  const hintId = useId()
  const isLogarithmic = !options && (logarithmic ?? (min > 0 && max / min >= 100))
  const update = (n: number) => { if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Number((Math.round(n / step) * step).toPrecision(12))))) }
  const optionIndex = options?.indexOf(value) ?? 0
  const position = options ? optionIndex / (options.length - 1) : max === min ? 0 : isLogarithmic ? logPosition(value, min, max) : (value - min) / (max - min)
  const nativeValue = options ? optionIndex : isLogarithmic ? Math.round(position * 10000) : value
  const rangeInput = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    // Native clamping after a bounds change can leave React's value tracking stale.
    // Synchronize through the public value setter so the next user input is observed.
    if (rangeInput.current) rangeInput.current.value = String(nativeValue)
  }, [nativeValue, min, max])
  return <div className={`range-control ${disabled ? 'disabled' : ''} ${companion ? 'range-with-companion' : ''}`}>
    {!hideLabel && <div className="control-label"><span>{label}</span>{input ? <div className="number-field"><input type="number" aria-label={`${label} exact value`} min={min} max={max} step={step} value={value} onChange={e => { if (e.target.value !== '') update(e.target.valueAsNumber) }} disabled={disabled} />{suffix}</div> : <output>{display ?? value}{suffix && <span> {suffix}</span>}</output>}</div>}
    <input ref={rangeInput} type="range" aria-label={label} aria-describedby={hint ? hintId : undefined} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={display ?? `${value.toLocaleString()}${suffix ?? ''}`} title="Double-click to reset to default"
      data-scale={options ? 'discrete' : isLogarithmic ? 'logarithmic' : 'linear'} min={options || isLogarithmic ? 0 : min} max={options ? options.length - 1 : isLogarithmic ? 10000 : max} step={options || isLogarithmic ? 1 : step} value={nativeValue} disabled={disabled}
      onChange={e => update(options ? options[e.target.valueAsNumber] : isLogarithmic ? logValue(e.target.valueAsNumber / 10000, min, max) : e.target.valueAsNumber)} onDoubleClick={() => { if (!disabled) update(resetValue) }} style={{ '--range-progress': `${position * 100}%` } as React.CSSProperties} />
    <div className="range-bounds"><span>{minLabel ?? min.toLocaleString()}</span>{isLogarithmic && <span className="range-scale">Log scale</span>}<span>{maxLabel ?? `${max.toLocaleString()}${suffix ? ` ${suffix}` : ''}`}</span></div>
    {hint && <div className="range-hint" id={hintId}>{hint}</div>}
    {companion && <div className="range-companion">{companion}</div>}
  </div>
}

/** Mount controls immediately; animate only their appearance, keeping focus and input available. */
export function Reveal({ show, id, children }: { show: boolean; id?: string; children: ReactNode }) {
  return <div id={id} hidden={!show}>{show && <div className="option-reveal">{children}</div>}</div>
}

export function Stepper({ label, value, min, max, onChange, ariaLabel }: { label: ReactNode; value: number; min: number; max: number; onChange: (n: number) => void; ariaLabel?: string }) {
  const name = ariaLabel ?? (typeof label === 'string' ? label : 'Quantum number')
  const fieldId = useId()
  const input = useRef<HTMLInputElement>(null), initial = useRef(value)
  const current = useRef({ value, min, max, onChange })
  current.current = { value, min, max, onChange }
  const dirty = useRef(false), focused = useRef(false), submitted = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const writeDraft = (text: string) => { if (input.current) input.current.value = text }
  const clamp = (n: number) => Math.max(current.current.min, Math.min(current.current.max, Math.round(n)))
  const commit = () => {
    clearTimeout(timer.current)
    const text = input.current?.value ?? ''
    const next = dirty.current && text.trim() !== '' && Number.isFinite(Number(text)) ? clamp(Number(text)) : current.current.value
    writeDraft(String(next))
    dirty.current = next !== current.current.value
    if (dirty.current && next !== submitted.current) {
      submitted.current = next
      current.current.onChange(next)
    }
  }
  useLayoutEffect(() => {
    // Keep the native draft while focused. Queued React value updates must not
    // clear its selection between focusing the field and typing a replacement.
    if (submitted.current === value) submitted.current = null
    if (focused.current || (dirty.current && Number(input.current?.value) !== value)) return
    dirty.current = false
    writeDraft(String(value))
  }, [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  const step = (direction: number) => {
    const text = input.current?.value ?? ''
    writeDraft(String(clamp((dirty.current && text !== '' && Number.isFinite(Number(text)) ? Number(text) : current.current.value) + direction)))
    dirty.current = true
    commit()
  }
  return <div className="stepper"><label htmlFor={fieldId}>{label}</label><div>
    <button aria-label={`Decrease ${name}`} disabled={value <= min} onClick={() => step(-1)}><Minus size={14} /></button>
    <input ref={input} id={fieldId} type="number" inputMode="numeric" aria-label={name} min={min} max={max} step={1} defaultValue={initial.current} onChange={e => {
      dirty.current = true; clearTimeout(timer.current)
      if (e.target.value.trim() !== '' && Number.isFinite(e.target.valueAsNumber)) timer.current = setTimeout(commit, 350)
    }} onBlur={() => { focused.current = false; commit() }} onFocus={e => { focused.current = true; e.target.select() }} onKeyDown={e => {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { clearTimeout(timer.current); dirty.current = false; writeDraft(String(current.current.value)) }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); step(e.key === 'ArrowUp' ? 1 : -1) }
    }} title="Type a number; press Enter to apply" />
    <button aria-label={`Increase ${name}`} disabled={value >= max} onClick={() => step(1)}><Plus size={14} /></button>
  </div></div>
}

export function ControlSection({ title, eyebrow, children, defaultOpen = true }: { title: string; eyebrow?: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="control-section" open={defaultOpen}><summary>{eyebrow && <span className="section-number">{eyebrow}</span>}<span>{title}</span><ChevronDown size={14} /></summary><div className="section-body">{children}</div></details>
}

export function PermanentControlSection({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  const headingId = useId()
  return <section className="control-section permanent-control-section" aria-labelledby={headingId}>
    <div className="control-section-heading">{eyebrow && <span className="section-number">{eyebrow}</span>}<h2 id={headingId}>{title}</h2></div>
    {children && <div className="section-body">{children}</div>}
  </section>
}

export function Scientific({ value, unit, digits = 3 }: { value: number; unit?: string; digits?: number }) {
  if (!Number.isFinite(value)) return <span className="scientific">∞ {unit}</span>
  if (value === 0) return <span className="scientific">0 {unit}</span>
  const exponent = Math.floor(Math.log10(Math.abs(value)))
  const coefficient = value / 10 ** exponent
  return <span className="scientific">{coefficient.toFixed(digits - 1)} <span className="times">×</span> 10<sup>{exponent}</sup>{unit && <small> {unit}</small>}</span>
}
