import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/meal-support-app/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/maps-api': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/maps-api/, '/maps/api'),
      },
    },
  },
})
