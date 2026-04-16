import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Base path depends on where we're serving from:
  // - GitHub Pages: '/CarePal_HR_Tool/' (repo-name path)
  // - Cloud Run / same-origin backend: '/' (root)
  // Set VITE_BASE in the build env to override (see Dockerfile).
  base: process.env.VITE_BASE || '/CarePal_HR_Tool/',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/carepal-demo/**', '**/Background info/**', '**/unpacked_recruitment/**'],
    },
    // Proxy API calls to the backend so the browser sees a single origin.
    // In production, Express will serve the built frontend from the same port
    // and this proxy goes away — the relative `/api/...` paths keep working.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
