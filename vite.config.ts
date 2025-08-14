import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/generative-blend/',
  server: {
    allowedHosts: true,
  },
  plugins: [react()],
})
