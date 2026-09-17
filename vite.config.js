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
    host: true, // 0.0.0.0，允许局域网访问
    port: 5173,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: 'lakehouse',
    assetsDir: 'assets',
  },
})
