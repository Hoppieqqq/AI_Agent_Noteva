import esbuild from 'esbuild'
import { builtinModules } from 'node:module'

const watch = process.argv.includes('--watch')

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  outfile: 'main.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  treeShaking: true,
  logLevel: 'info',
  jsx: 'automatic',
  external: ['obsidian', 'electron', ...builtinModules],
  banner: {
    js: '/* Bundled by esbuild for Noteva AI Agent */'
  }
})

if (watch) {
  await context.watch()
  console.log('[noteva-ai-agent] watching...')
} else {
  await context.rebuild()
  await context.dispose()
  console.log('[noteva-ai-agent] build completed')
}
