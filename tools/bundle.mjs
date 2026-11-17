/**
 * 半刻的生产构建：Rollup + SWC + terser，全程在 Node 进程内完成。
 * 产物是单个 dist/index.html（以及根目录的 半刻.html），可直接双击打开。
 */
import { rollup } from 'rollup'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import { minify } from 'terser'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { swcPlugin } from './swcPlugin.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function cssCollector() {
  const styles = []
  return {
    name: 'banke:css',
    async resolveId(source, importer) {
      if (!source.endsWith('.css')) return null
      return path.resolve(path.dirname(importer ?? root), source)
    },
    async load(id) {
      if (!id.endsWith('.css')) return null
      styles.push(await readFile(id, 'utf8'))
      return 'export default {}'
    },
    styles() {
      return styles.join('\n\n')
    },
  }
}

const css = cssCollector()

const bundle = await rollup({
  input: path.join(root, 'src/main.tsx'),
  plugins: [
    replace({
      preventAssignment: true,
      values: { 'process.env.NODE_ENV': JSON.stringify('production') },
    }),
    swcPlugin(),
    nodeResolve({
      browser: true,
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
      exportConditions: ['browser', 'module', 'import', 'default'],
    }),
    commonjs({ include: /node_modules/, transformMixedEsModules: true }),
    css,
  ],
  onwarn(warning, warn) {
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'SOURCEMAP_ERROR') return
    if (warning.code === 'CIRCULAR_DEPENDENCY') return
    warn(warning)
  },
})

const { output } = await bundle.generate({ format: 'es', inlineDynamicImports: true, sourcemap: false })
const chunk = output.find((item) => item.type === 'chunk')
if (!chunk) throw new Error('没有生成 JS chunk')

const minified = await minify(chunk.code, {
  compress: { passes: 2, drop_debugger: true },
  mangle: true,
  format: { comments: false },
})
const js = (minified.code ?? chunk.code).replace(/<\/script/gi, '<\\/script')
const cssText = css.styles()

let html = await readFile(path.join(root, 'index.html'), 'utf8')
const tag = '<script type="module" src="/src/main.tsx"></script>'
const inline = `<style>\n${cssText}\n</style>\n<script type="module">\n${js}\n</script>`
// 用函数形式替换：内联脚本里充满 $&、$' 之类的字符，
// 直接当替换字符串会被 String.replace 当成特殊模式，把整段脚本写坏。
if (html.includes(tag)) html = html.replace(tag, () => inline)
else html = html.replace(/<script[^>]*src="[^"]*main\.tsx"[^>]*><\/script>/, () => inline)

await mkdir(path.join(root, 'dist'), { recursive: true })
const outFile = path.join(root, 'dist/index.html')
await writeFile(outFile, html, 'utf8')
await writeFile(path.join(root, '半刻.html'), html, 'utf8')

const size = (await stat(outFile)).size
console.log(`✓ 半刻.html  ${(size / 1024 / 1024).toFixed(2)} MB`)
console.log(`  js ${(js.length / 1024).toFixed(0)} KB · css ${(cssText.length / 1024).toFixed(0)} KB · 单文件可离线运行`)

await bundle.close()
