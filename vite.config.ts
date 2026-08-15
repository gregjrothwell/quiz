import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/quiz/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /**
         * Firebase in its own chunk, and the reason is the deploy rather than
         * the download.
         *
         * As one file, every deploy changed the bundle's content hash — so a
         * returning player re-downloaded the whole 260 kB gzipped, including the
         * ~250 kB of Firebase that had not changed, and saw nothing at all until
         * it landed because index.html is a 0.7 kB shell. That is the delay on
         * the first load after each deploy, and only after each deploy: every
         * visit afterwards was cached.
         *
         * Split, an ordinary change to the game leaves the Firebase chunk's hash
         * alone, so the browser reuses what it already has and fetches only the
         * app.
         *
         * Matched on the path rather than the package name so `@firebase/*`,
         * which is what the `firebase` package actually re-exports, lands in the
         * same chunk instead of back in the app.
         */
        manualChunks(id: string) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          // Same argument, smaller number. `motion` is used in two places —
          // MotionConfig and the standings reorder — and changes about as often
          // as Firebase does, which is never. Left in the app chunk it is
          // re-downloaded on every deploy along with the code that did change.
          //
          // Matched on `framer-motion` too, which is what `motion/react`
          // actually re-exports, or half of it lands back in the app chunk.
          if (
            id.includes('node_modules/motion')
            || id.includes('node_modules/framer-motion')
          ) {
            return 'motion';
          }
          return undefined;
        },
      },
    },
  },
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
