import type { Extension } from '@codemirror/state'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import type { CodeEditorMode } from './codeEditor'
import { autocompletion, completeFromList } from '@codemirror/autocomplete'
import { html } from '@codemirror/lang-html'
import { javascriptLanguage } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { liquid } from '@codemirror/lang-liquid'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { keysUnder, namesOf } from './codeCompletion'

/** What Liquid completion reads: the preview's data and the names of Kuroshiro's own filters. */
export interface LiquidCompletion {
  data: Record<string, unknown>
  filters: readonly string[]
}

const LIQUID_NODES = ['Interpolation', 'Tag', 'EndTag', 'Comment']
const washMark = Decoration.mark({ class: 'cm-liquid' })

function washBehindLiquid(view: EditorView): DecorationSet {
  const marks = new RangeSetBuilder<Decoration>()
  view.visibleRanges.forEach(({ from, to }) => syntaxTree(view.state).iterate({
    from,
    to,
    enter: (node) => {
      if (!LIQUID_NODES.includes(node.name))
        return
      marks.add(node.from, node.to, washMark)
      return false
    },
  }))
  return marks.finish()
}

/** The `wash` ground behind every `{{ … }}`, `{% … %}` and comment, which is how Liquid is told from HTML. */
const liquidWash = ViewPlugin.fromClass(class {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = washBehindLiquid(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state))
      this.decorations = washBehindLiquid(update.view)
  }
}, { decorations: plugin => plugin.decorations })

const JAVASCRIPT_KEYWORDS = 'async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield'
  .split(' ')
  .map(label => ({ label, type: 'keyword' }))

/** Liquid and HTML complete what their language offers, JavaScript only its keywords, JSON nothing. */
export function completionOf(mode: CodeEditorMode): Extension {
  if (mode === 'json')
    return []
  return autocompletion({ icons: false, override: mode === 'javascript' ? [completeFromList(JAVASCRIPT_KEYWORDS)] : undefined })
}

export function languageOf(mode: CodeEditorMode, { data, filters }: LiquidCompletion): Extension {
  if (mode === 'liquid') {
    return [
      liquid({
        base: html(),
        variables: namesOf(data).map(name => ({ ...name, type: 'variable' })),
        filters: filters.map(label => ({ label, type: 'function', detail: 'Kuroshiro' })),
        properties: path => keysUnder(data, path).map(key => ({ ...key, type: 'property' })),
      }),
      liquidWash,
    ]
  }
  if (mode === 'html')
    return html()
  return mode === 'javascript' ? javascriptLanguage : json()
}
