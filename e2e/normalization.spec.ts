import { expect, test } from '@playwright/test'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

test('GPU probability and joint density integrate to one throughout pulses and all state modes', async ({ page }) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const bundle = await build({ entryPoints: [resolve('e2e/fixtures/normalization.ts')], bundle: true, write: false, format: 'iife', platform: 'browser' })
  await page.goto('about:blank'); await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(() => window.normalizationGPU)
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/normalization-gpu-audit.json', JSON.stringify(result, null, 2) + '\n')
  await test.info().attach('gpu-normalization-integrals', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  expect(errors).toEqual([])
  expect(result).toHaveLength(28)
  expect(result.reduce((sum, item) => sum + item.frames, 0)).toBe(1108)
  for (const item of result) {
    // Includes float32 GPU arithmetic and finite mesh quadrature. These are raw
    // integrals recovered from display scaling; no area correction is applied.
    expect(item.maximumError, JSON.stringify(item)).toBeLessThan(0.0001)
  }
})
