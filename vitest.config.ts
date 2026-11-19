/** Unit tests for the stores and path helpers. */
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // The design system's real entry pulls a syntax-highlighting and
      // markdown tree into the test process; the services under test only
      // need the names this plugin imports to resolve.
      '@deepseek-ai/dsh-client-ui-primitives': resolve(import.meta.dirname, 'tests/stubs/primitives.ts'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'jsdom',
  },
})
