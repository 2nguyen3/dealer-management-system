import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Chart-heavy jsdom renders exceed 5 s when all workers run in parallel.
    testTimeout: 15_000,
    // Chart-heavy pages render slower in jsdom when the whole suite runs in parallel.
    testTimeout: 15_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/src/test/live_docker_integration.test.ts',
    ],
  },
})
