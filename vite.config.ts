import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        generativeRadio: 'generative-radio.html',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:17846',
    },
  },
})
