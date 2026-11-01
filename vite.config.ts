import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three'
          if (id.includes('/node_modules/katex/')) return 'math'
          if (id.includes('/node_modules/@react-three/') || id.includes('/node_modules/three-stdlib/')) return 'scene'
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
