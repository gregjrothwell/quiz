import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/quiz/',
  plugins: [react()],
  test: {
    environment: 'node',
    // `scripts/` is included for the pure parts of the build-time code — the
    // OpenTriviaQA parser and its encoding fallback, which silently corrupt
    // questions when wrong. Anything under `scripts/` that talks to the network
    // or the live project stays untested here on purpose; `npm test` must keep
    // running offline.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
