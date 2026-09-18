import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      '/lh': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:82',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'lakehouse',
    assetsDir: 'assets',
  },
})
