import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import postcssConfig from './postcss.js'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version?: string }
const appVersion = pkg.version ?? '0.0.0'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    {
      name: 'version-json-dev',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = req.url?.split('?')[0]
          if (path === '/version.json') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ version: appVersion }))
            return
          }
          next()
        })
      },
    },
    {
      name: 'version-json',
      apply: 'build',
      buildStart() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: appVersion }),
        })
      },
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'background.webp', 'icons/192.png', 'icons/512.png'],
      manifest: {
        name: '笔记系统',
        short_name: '笔记',
        description: '个人笔记',
        theme_color: '#3b82f6',
        background_color: '#f3f4f6',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        id: '/',
        icons: [
          {
            src: '/icons/192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
  },
  css: {
    postcss: postcssConfig,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'editor-vendor': ['react-simplemde-editor', 'react-markdown'],
          'mermaid-vendor': ['mermaid'],
          'utils-vendor': ['axios', 'clsx'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
