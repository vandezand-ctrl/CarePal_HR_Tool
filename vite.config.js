import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/CarePal_HR_Tool/',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/carepal-demo/**', '**/Background info/**', '**/unpacked_recruitment/**'],
    },
  },
})
