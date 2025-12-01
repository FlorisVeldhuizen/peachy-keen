import { defineConfig } from 'vite'

export default defineConfig({
  base: '/experiments/peachy-keen/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'three-addons': ['three/examples/jsm/loaders/GLTFLoader.js']
        }
      }
    },
    // Minify and optimize (using esbuild for speed, no extra dependencies)
    minify: 'esbuild',
    // Note: esbuild doesn't support drop_console, but we don't have console.logs anyway
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Source maps for debugging (disable in production for smaller size)
    sourcemap: false,
    // Asset inlining threshold (in bytes) - inline small assets as base64
    assetsInlineLimit: 4096
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['three']
  }
})

