import { expect, test } from '@playwright/test'
import { build } from 'esbuild'
import { resolve } from 'node:path'

test('J=2, m=1 lobes occlude correctly from above at every opacity and triangle order', async ({ page }) => {
  const bundle = await build({ entryPoints: [resolve('e2e/fixtures/occlusion.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true })
  await page.goto('about:blank')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(() => window.occlusionResults)
  await test.info().attach('pixel-regression-results', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(result.cases).toHaveLength(36)
  for (const sample of result.cases) {
    expect(sample.covered, JSON.stringify(sample)).toBeGreaterThan(100)
    expect(sample.lowerLobeDifferences, JSON.stringify(sample)).toBe(0)
    expect(sample.orderDifferences, JSON.stringify(sample)).toBe(0)
  }
  // A negative control confirms this test exposes the original transparent-lobe bug.
  expect(result.oldPipelineDifferences).toBeGreaterThan(100)
  await page.screenshot({ path: 'test-results/wavefunction-depth-regression.png' })
})
