import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monacoEditorPlugin from '@dvaji/vite-plugin-monaco-editor'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService'],
      customDistPath(_root, buildOutDir) {
        return `${buildOutDir}/monacoeditorwork`
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    // Cloudflare Tunnel / 临时公网域名会改 Host，需放行
    allowedHosts: true,
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      '/lakehouse': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'lakehouse',
    assetsDir: 'assets',
  },
})
