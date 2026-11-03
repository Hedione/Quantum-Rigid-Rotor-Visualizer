import { expect, test } from '@playwright/test'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { HBAR, molecularParameters, quantumQuantities } from '../src/physics/quantum'
import { QUANTUM_TIME_SCALE } from '../src/physics/evolution'

declare global { interface Window { evolutionTestTime: number; evolutionRequests: number } }

test('GPU evolution matches independently evaluated angular surfaces at multiple phases', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const bundle = await build({ entryPoints: [resolve('e2e/fixtures/evolution.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true })
  await page.goto('about:blank'); await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(() => window.evolutionPixels)
  await test.info().attach('animated-surface-pixel-results', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(errors).toEqual([])
  expect(result.cases).toHaveLength(21)
  for (const sample of result.cases) {
    if (sample.positionError !== undefined) expect(sample.positionError, JSON.stringify(sample)).toBeLessThan(0.0001)
    // GPU and CPU arithmetic may differ at individual rasterization boundaries.
    expect(sample.interiorMismatches, JSON.stringify(sample)).toBe(0)
    expect(sample.mismatches, JSON.stringify(sample)).toBeLessThanOrEqual(20)
    if (sample.referenceCovered > 100) expect(sample.covered, JSON.stringify(sample)).toBeGreaterThan(100)
  }
  expect(result.changedJointPixels).toBeGreaterThan(1000)
  await page.screenshot({ path: 'test-results/evolving-surface-pixels.png' })
})

test('time evolution synchronizes sampled interference and the surface, and pauses or returns to t=0', async ({ page }) => {
  await page.addInitScript(() => {
    window.evolutionTestTime = 10000
    performance.now = () => window.evolutionTestTime
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => raf(() => callback(window.evolutionTestTime))
    window.evolutionRequests = 0
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(message: unknown) { window.evolutionRequests++; super.postMessage(message) }
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  const stage = page.getByRole('region', { name: 'Unified classical and quantum rotor experiment' })
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await page.getByRole('button', { name: 'Superposition mode', exact: true }).click()
  const toggle = page.getByRole('button', { name: 'Evolve in time', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  for (const [name, value] of [['J', '0'], ['Second J', '1'], ['Second mJ', '0']]) {
    const input = page.getByRole('spinbutton', { name, exact: true }); await input.fill(value); await input.press('Enter')
  }
  await expect(stage).toHaveAttribute('data-displayed-j', '0')
  await expect(stage).toHaveAttribute('data-displayed-m2', '0')
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  const preparationCount = await page.evaluate(() => window.evolutionRequests)
  await expect(stage).toHaveAttribute('data-evolving', 'true')
  const speed = page.getByRole('slider', { name: 'Evolution playback speed', exact: true })
  await expect(speed).toHaveAttribute('aria-valuenow', '1')
  await expect(speed).toHaveAttribute('aria-valuemax', '100')
  await speed.focus(); await speed.press('End')
  await expect(speed).toHaveAttribute('aria-valuenow', '100')
  await speed.dblclick()
  await expect(speed).toHaveAttribute('aria-valuenow', '1')
  const readout = page.getByTestId('quantum-time')
  await expect(readout).toHaveAttribute('data-time', '0')
  const surface = page.getByTestId('scene-wavefunction').locator('canvas')
  const before = await surface.screenshot()
  const meanU = () => page.locator('.polar-chart svg rect').evaluateAll(rects => {
    const heights = rects.map(rect => Number(rect.getAttribute('height')))
    return heights.reduce((sum, h, i) => sum + h * (-1 + (i + 0.5) * 2 / heights.length), 0) / heights.reduce((a, b) => a + b, 0)
  })
  expect(await meanU()).toBeGreaterThan(0.5)
  await page.getByRole('button', { name: 'Resume sampling', exact: true }).click()
  const { inertia } = molecularParameters(1, 0.74), rate = quantumQuantities(1, 0, inertia).energy / HBAR
  const halfBeatMs = Math.PI / rate / QUANTUM_TIME_SCALE * 1000
  await page.evaluate(delta => { window.evolutionTestTime += delta }, halfBeatMs)
  await expect.poll(meanU).toBeLessThan(-0.5)
  await expect.poll(async () => Number(await readout.getAttribute('data-time'))).toBeGreaterThan(0)
  const after = await surface.screenshot()
  expect(after.equals(before)).toBe(false)
  expect(await page.evaluate(() => window.evolutionRequests)).toBe(preparationCount)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const frozenTime = await readout.getAttribute('data-time')
  await page.evaluate(() => { window.evolutionTestTime += 10000 })
  await expect(readout).toHaveAttribute('data-time', frozenTime!)
  expect((await surface.screenshot()).equals(after)).toBe(true)
  await page.screenshot({ path: 'test-results/time-evolution-paused.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/time-evolution-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'SIMULATION SETTINGS', exact: true }).click()
  await toggle.click()
  await expect(stage).toHaveAttribute('data-evolving', 'false')
  await expect(readout).toHaveCount(0)
  await expect.poll(meanU).toBeGreaterThan(0.5)
  expect(errors).toEqual([])
})
