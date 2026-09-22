import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'oxc' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rolldownOptions: {
      output: {
        // The Siddur corpus is ~370kB of static data. Kept out of the app chunk so
        // the UI code stays reviewable in isolation and the two load in parallel.
        advancedChunks: {
          groups: [{ name: 'siddur-corpus', test: /siddur\.corpus\.json/ }],
        },
      },
    },
  },
})
