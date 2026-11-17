import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { swcPlugin } from './tools/swcPlugin.mjs'

// 单文件构建：dist/index.html 可以直接双击打开，
// 也可作为 Capacitor（APK）与 Electron（exe）的入口。
// TS/TSX 交给 SWC，避免构建时依赖 esbuild 子进程。
export default defineConfig({
  base: './',
  plugins: [swcPlugin(), viteSingleFile({ removeViteModuleLoader: true })],
  esbuild: {
    include: /\.jsx$/,
    exclude: [/node_modules/, /\.tsx?$/],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4096,
    reportCompressedSize: false,
    minify: 'terser',
    cssMinify: false,
    terserOptions: {
      compress: { passes: 1 },
      format: { comments: false },
    },
  },
  server: { host: '127.0.0.1', port: 5273 },
})
