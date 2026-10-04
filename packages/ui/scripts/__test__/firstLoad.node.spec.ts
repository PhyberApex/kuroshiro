import type { BundleChunk } from '../firstLoad.ts'
import { describe, expect, it } from 'vitest'
import { lazyModulesInFirstLoad } from '../firstLoad.ts'

const CODEMIRROR = '/repo/node_modules/.pnpm/@codemirror+view@6.0.0/node_modules/@codemirror/view/dist/index.js'

function chunk(fileName: string, overrides: Partial<BundleChunk> = {}): BundleChunk {
  return { fileName, isEntry: false, isDynamicEntry: false, facadeModuleId: null, imports: [], moduleIds: [], ...overrides }
}

const entry = (overrides: Partial<BundleChunk> = {}) => chunk('index.js', { isEntry: true, facadeModuleId: '/repo/index.html', ...overrides })
function editor(overrides: Partial<BundleChunk> = {}) {
  return chunk('codeEditorView.js', {
    isDynamicEntry: true,
    facadeModuleId: '/repo/src/components/codeEditorView.ts',
    moduleIds: ['/repo/src/components/codeEditorView.ts', CODEMIRROR],
    ...overrides,
  })
}

describe('the editor stays out of every first load', () => {
  it('passes when CodeMirror is only in the chunk fetched with the first editor', () => {
    expect(lazyModulesInFirstLoad([entry(), editor()])).toEqual([])
  })

  it('passes when the editor chunk shares CodeMirror through a chunk of its own', () => {
    const shared = chunk('codemirror.js', { moduleIds: [CODEMIRROR] })

    expect(lazyModulesInFirstLoad([entry(), shared, editor({ imports: ['codemirror.js'], moduleIds: [] })])).toEqual([])
  })

  it('fails when a CodeMirror module is in the entry chunk', () => {
    expect(lazyModulesInFirstLoad([entry({ moduleIds: ['/repo/src/main.ts', CODEMIRROR] }), editor()]))
      .toEqual([`index.js loads ${CODEMIRROR}`])
  })

  it('fails when the entry chunk imports a chunk that holds one', () => {
    const shared = chunk('shared.js', { moduleIds: [CODEMIRROR] })

    expect(lazyModulesInFirstLoad([entry({ imports: ['vendor.js'] }), chunk('vendor.js', { imports: ['shared.js'] }), shared]))
      .toEqual([`index.js loads ${CODEMIRROR}`])
  })

  it('fails when a route\'s chunk holds one', () => {
    const route = chunk('PluginPage.js', { isDynamicEntry: true, facadeModuleId: '/repo/src/pages/PluginPage.vue', moduleIds: [CODEMIRROR] })

    expect(lazyModulesInFirstLoad([entry(), route])).toEqual([`PluginPage.js loads ${CODEMIRROR}`])
  })

  it('fails when a route\'s chunk imports the editor chunk statically', () => {
    const route = chunk('PluginPage.js', { isDynamicEntry: true, facadeModuleId: '/repo/src/pages/PluginPage.vue', imports: ['codeEditorView.js'] })

    expect(lazyModulesInFirstLoad([entry(), route, editor()])).toEqual([`PluginPage.js loads ${CODEMIRROR}`])
  })

  it('fails when a route\'s chunk holds the Liquid engine, and passes when only the Template preview\'s own chunk does', () => {
    const liquid = '/repo/node_modules/.pnpm/liquidjs@10.0.0/node_modules/liquidjs/dist/liquid.browser.mjs'
    const route = chunk('PluginPage.js', { isDynamicEntry: true, facadeModuleId: '/repo/src/pages/PluginPage.vue', moduleIds: [liquid] })
    const preview = chunk('templatePreview.js', { isDynamicEntry: true, facadeModuleId: '/repo/src/pages/plugins/templatePreview.ts', moduleIds: [liquid] })

    expect(lazyModulesInFirstLoad([entry(), route])).toEqual([`PluginPage.js loads ${liquid}`])
    expect(lazyModulesInFirstLoad([entry(), preview])).toEqual([])
  })
})
