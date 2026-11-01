import { expect, test } from '@playwright/test'

declare global { interface Window { histogramPreparations: number } }

test('histogram resolution preserves samples and evolution has an independent speed slider', async ({ page }) => {
  await page.addInitScript(() => {
    window.histogramPreparations = 0
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      postMessage(message: unknown) { window.histogramPreparations++; super.postMessage(message) }
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const stage = page.getByRole('region', { name: 'Unified classical and quantum rotor experiment' })
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('slider', { name: 'Sampling frequency', exact: true })).toHaveValue('30')
  const diagnostics = page.getByRole('region', { name: 'Orientation distribution diagnostics' })
  await expect(diagnostics).toHaveAttribute('data-update-hz', '30')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const total = await page.getByTestId('cumulative-samples').textContent()
  const preparations = await page.evaluate(() => window.histogramPreparations)
  const bins = page.getByRole('slider', { name: 'Histogram bins', exact: true })
  await expect(bins).toHaveAttribute('aria-valuenow', '40')
  const rate = page.getByRole('slider', { name: 'Histogram sampling rate', exact: true })
  await expect(rate).toHaveValue('30')
  const footer = diagnostics.locator('.diagnostics-footer')
  const actions = await footer.locator('.diagnostics-footer-actions').boundingBox()
  for (const name of ['Histogram bins', 'Histogram sampling rate']) {
    const box = await footer.getByRole('slider', { name, exact: true }).locator('..').boundingBox()
    expect(Math.abs(box!.y + box!.height / 2 - actions!.y - actions!.height / 2)).toBeLessThan(2)
  }
  await rate.focus(); await rate.press('Home')
  await expect(rate).toHaveValue('1')
  await expect(diagnostics).toHaveAttribute('data-update-hz', '1')
  await expect(page.getByRole('slider', { name: 'Sampling frequency', exact: true })).toHaveValue('30')
  await rate.dblclick(); await expect(rate).toHaveValue('30')
  for (const [key, count] of [['End', 320], ['Home', 10]] as const) {
    await bins.focus(); await bins.press(key)
    await expect(bins).toHaveAttribute('aria-valuenow', String(count))
    await expect(diagnostics.locator('.polar-chart svg rect')).toHaveCount(count)
    await expect(diagnostics.locator('.azimuthal-chart svg rect')).toHaveCount(count)
    expect(await diagnostics.locator('svg rect').evaluateAll(rects => rects.every(rect => Number(rect.getAttribute('width')) > 0))).toBe(true)
    await expect(page.getByTestId('cumulative-samples')).toHaveText(total!)
  }
  await bins.dblclick()
  await expect(bins).toHaveAttribute('aria-valuenow', '40')
  await page.getByRole('button', { name: 'Current batch', exact: true }).click()
  await bins.focus(); await bins.press('End')
  await expect(diagnostics.locator('.polar-chart svg rect')).toHaveCount(320)
  await page.getByRole('button', { name: 'Solid-angle probability', exact: true }).click()
  await expect(diagnostics.locator('.polar-chart svg rect')).toHaveCount(320)
  await expect(page.getByTestId('cumulative-samples')).toHaveText(total!)
  expect(await page.evaluate(() => window.histogramPreparations)).toBe(preparations)
  await diagnostics.screenshot({ path: 'test-results/histogram-bins-desktop.png' })
  await page.getByRole('button', { name: 'Enable', exact: true }).click()
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByTestId('superposition-controls')).not.toContainText('Adding amplitudes creates interference')
  await page.getByRole('switch', { name: 'Evolve in time', exact: true }).click()
  const speed = page.getByRole('slider', { name: 'Evolution playback speed', exact: true })
  await expect(speed).toHaveValue('1'); await expect(speed).toHaveAttribute('min', '0.01'); await expect(speed).toHaveAttribute('max', '5')
  const preparedAtEvolution = await page.evaluate(() => window.histogramPreparations)
  await speed.focus(); await speed.press('End'); await expect(speed).toHaveValue('5')
  await expect(page.getByRole('slider', { name: 'Playback speed', exact: true })).toHaveValue('1')
  await speed.press('Home'); await expect(speed).toHaveValue('0.01')
  await speed.dblclick(); await expect(speed).toHaveValue('1')
  await expect(page.getByTestId('superposition-controls')).not.toContainText('Adding amplitudes creates interference')
  expect(await page.evaluate(() => window.histogramPreparations)).toBe(preparedAtEvolution)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/histogram-and-speed-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})

test('lowering histogram sampling reduces recorded batches while quantum time keeps advancing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'histogramTestTime', { value: 10000, writable: true })
    const clock = window as typeof window & { histogramTestTime: number }
    performance.now = () => clock.histogramTestTime
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => raf(() => callback(clock.histogramTestTime))
  })
  await page.goto('/')
  const stage = page.getByRole('region', { name: 'Unified classical and quantum rotor experiment' })
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Enable', exact: true }).click()
  await expect(stage).toHaveAttribute('data-superposition', 'true')
  await expect(stage).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('switch', { name: 'Evolve in time', exact: true }).click()
  const rate = page.getByRole('slider', { name: 'Histogram sampling rate', exact: true })
  await rate.focus(); await rate.press('Home')
  await expect(rate).toHaveValue('1')
  const count = page.getByTestId('cumulative-samples')
  await expect(count).toHaveText('2,000')
  const advance = async (milliseconds: number) => {
    await page.evaluate(delta => { (window as typeof window & { histogramTestTime: number }).histogramTestTime += delta }, milliseconds)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  }
  await advance(0)
  await advance(250); await advance(250); await advance(250)
  await expect(count).toHaveText('2,000')
  expect(Number(await page.getByTestId('quantum-time').getAttribute('data-time'))).toBeGreaterThan(0)
  await advance(250)
  await expect(count).toHaveText('4,000')
  await advance(500)
  await expect(count).toHaveText('4,000')
  await rate.focus(); await rate.press('End')
  await advance(0)
  await advance(17)
  await expect(count).toHaveText('6,000')
  await expect(page.getByRole('slider', { name: 'Sampling frequency', exact: true })).toHaveValue('30')
})
