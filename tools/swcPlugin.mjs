import { transform } from '@swc/core'

/**
 * 用 SWC 直接接管 TS/TSX，替代 Vite 自带的 esbuild 转换。
 * 好处：构建与压缩全部在进程内完成，不依赖 esbuild 的常驻子进程。
 */
export function swcPlugin() {
  return {
    name: 'banke:swc',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0]
      if (file.includes('node_modules') || file.startsWith('\0')) return null
      if (!/\.(tsx?|jsx)$/.test(file)) return null

      const isTs = file.endsWith('.ts') || file.endsWith('.tsx')
      const isJsx = file.endsWith('.tsx') || file.endsWith('.jsx')
      const result = await transform(code, {
        filename: file,
        sourceMaps: true,
        jsc: {
          target: 'es2020',
          parser: isTs
            ? { syntax: 'typescript', tsx: isJsx, decorators: false }
            : { syntax: 'ecmascript', jsx: true },
          transform: {
            react: { runtime: 'automatic', development: false, importSource: 'react' },
          },
        },
      })
      return {
        code: result.code,
        map: result.map ? JSON.parse(result.map) : null,
      }
    },
  }
}
