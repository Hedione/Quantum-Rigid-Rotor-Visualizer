import { expect, test } from '@playwright/test'
import { build } from 'esbuild'
import { resolve } from 'node:path'

test('opaque evolving surfaces have no black holes across quantities, phases, and camera angles', async ({ page }) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const bundle = await build({ entryPoints: [resolve('e2e/fixtures/surface-rendering.ts')], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true })
  await page.goto('about:blank'); await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(() => window.surfaceRendering)
  console.log(`Surface coverage: ${result.cases.length} cases, ${result.cases.reduce((sum, sample) => sum + sample.holes, 0)} holes; legacy depth pass: ${result.legacyHoles} holes.`)
  await test.info().attach('surface-rendering-results', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(errors).toEqual([])
  expect(result.glError).toBe(0)
  expect(result.cases).toHaveLength(90)
  for (const sample of result.cases) {
    expect(sample.holes, JSON.stringify(sample)).toBe(0)
    expect(sample.covered, JSON.stringify(sample)).toBeGreaterThan(20)
  }
})
