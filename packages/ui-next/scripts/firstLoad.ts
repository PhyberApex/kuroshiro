/** What the check reads of a chunk; Rollup's output chunk has all of it. */
export interface BundleChunk {
  fileName: string
  isEntry: boolean
  isDynamicEntry: boolean
  facadeModuleId: string | null
  /** The chunks this one imports statically, by file name. */
  imports: string[]
  moduleIds: string[]
}

/** Modules that may only arrive with the first code editor on a page. */
const LAZY_ONLY = ['/@codemirror/']

/** The modules whose dynamic import is the one door to the lazy-only ones. */
const LAZY_DOORS = ['/src/components/codeEditorView.ts']

const isLazyDoor = (chunk: BundleChunk) => LAZY_DOORS.some(door => chunk.facadeModuleId?.endsWith(door))

/** A chunk the browser asks for by itself: the entry, and every dynamic import but the editor's own. A route is one of these. */
const startsALoad = (chunk: BundleChunk) => chunk.isEntry || (chunk.isDynamicEntry && !isLazyDoor(chunk))

function loadedWith(root: BundleChunk, byFileName: Map<string, BundleChunk>) {
  const seen = new Set<BundleChunk>()
  const visit = (chunk: BundleChunk | undefined) => {
    if (!chunk || seen.has(chunk))
      return
    seen.add(chunk)
    chunk.imports.forEach(fileName => visit(byFileName.get(fileName)))
  }
  visit(root)
  return [...seen]
}

/** Names every lazy-only module that a first load would fetch: "PluginPage.js loads …/@codemirror/view/dist/index.js". */
export function lazyModulesInFirstLoad(chunks: BundleChunk[]): string[] {
  const byFileName = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  return chunks.filter(startsALoad).flatMap(root =>
    loadedWith(root, byFileName)
      .flatMap(chunk => chunk.moduleIds)
      .filter(moduleId => LAZY_ONLY.some(part => moduleId.includes(part)))
      .map(moduleId => `${root.fileName} loads ${moduleId}`),
  )
}
