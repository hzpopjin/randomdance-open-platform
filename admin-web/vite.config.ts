import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/fa-api': {
        target: 'https://chunyin.jilllees.top:8443',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fa-api/, '/api'),
      },
      '/api/v1': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
