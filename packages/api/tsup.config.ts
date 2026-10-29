import { defineConfig } from 'tsup'

export default defineConfig({
  // The transform worker is bundled beside main.js under the name PluginTransformService loads it by (ADR-0072).
  entry: { 'main': 'src/main.ts', 'plugin-transform.worker': 'src/plugins/services/plugin-transform.worker.ts' },
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  minify: true,
  target: 'es2022',
  external: ['node_modules'],
  noExternal: ['kuroshiro-shared'],
})
