import type { Diagnostic } from '@codemirror/lint'
import type { Extension, Text } from '@codemirror/state'
import type { CodeEditorMode, CodeEditorSize, CodeProblem, CodeValidity } from './codeEditor'
import type { LiquidCompletion } from './codeEditorLanguage'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { jsonParseLinter } from '@codemirror/lang-json'
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
import { forceLinting, linter, lintGutter, setDiagnostics } from '@codemirror/lint'
import { search, searchKeymap } from '@codemirror/search'
import { Annotation, Compartment, EditorState } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { completionOf, languageOf } from './codeEditorLanguage'
import { hankoLook, sizeLook } from './codeEditorTheme'

/** What the caller may change while the editor lives. Each document's state gets it anew when it is shown. */
export interface CodeEditorSettings {
  readOnly: boolean
  /** The attributes of the element that is typed in: its name, its description, `aria-invalid`. */
  attributes: Record<string, string>
  completion: LiquidCompletion
  problem: CodeProblem | null
}

export interface CodeEditorOptions extends CodeEditorSettings {
  parent: HTMLElement
  text: string
  /** Names the document shown first; see `show`. */
  document: string
  mode: CodeEditorMode
  size: CodeEditorSize
  onChange: (text: string) => void
  onSave: () => void
  onValidity: (validity: CodeValidity) => void
}

export type CodeEditor = ReturnType<typeof createCodeEditor>

const JSON_UNDERLINE_DELAY = 300

/** CodeMirror words its search in lower case; these are the same words as the rest of the UI writes them. */
const SEARCH_WORDS = {
  'next': 'Next',
  'previous': 'Previous',
  'all': 'Select all',
  'match case': 'Match case',
  'regexp': 'Regular expression',
  'by word': 'Whole word',
  'replace': 'Replace',
  'replace all': 'Replace all',
  'close': 'Close search',
}

/** Marks a change that came from the caller, which is not reported back to it. */
const fromCaller = Annotation.define<boolean>()

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const lineAt = (doc: Text, line: number) => doc.line(clamp(line, 1, doc.lines))

function placeOf(problem: CodeProblem, doc: Text) {
  if (problem.from !== undefined) {
    const from = clamp(problem.from, 0, doc.length)
    return { from, to: clamp(problem.to ?? from, from, doc.length) }
  }
  const line = lineAt(doc, problem.line!)
  const indent = line.text.length - line.text.trimStart().length
  return { from: line.from + indent, to: line.to }
}

function diagnosticsOf(problem: CodeProblem | null, doc: Text): Diagnostic[] {
  if (!problem || (problem.line === null && problem.from === undefined))
    return []
  return [{ ...placeOf(problem, doc), severity: 'error', message: problem.message }]
}

const findJsonProblems = jsonParseLinter()

/** An empty JSON input is nothing to parse, not a mistake. A mistake is widened to a character, so it is underlined and not a point. */
function jsonDiagnostics(view: EditorView): Diagnostic[] {
  const { doc } = view.state
  if (doc.toString().trim() === '')
    return []
  return findJsonProblems(view).map((found) => {
    const from = clamp(found.from, 0, Math.max(doc.length - 1, 0))
    return { ...found, from, to: Math.min(from + 1, doc.length) }
  })
}

function validityOf(view: EditorView): CodeValidity {
  const [problem] = jsonDiagnostics(view)
  return { valid: !problem, message: problem?.message ?? null }
}

const hasLineNumbers = (mode: CodeEditorMode) => mode !== 'json'

function problemSupport(mode: CodeEditorMode): Extension {
  if (mode === 'liquid' || mode === 'html')
    return lintGutter()
  return mode === 'json' ? linter(jsonDiagnostics, { delay: JSON_UNDERLINE_DELAY }) : []
}

export function createCodeEditor(options: CodeEditorOptions) {
  const { mode } = options
  const settings: CodeEditorSettings = {
    readOnly: options.readOnly,
    attributes: options.attributes,
    completion: options.completion,
    problem: options.problem,
  }
  const language = new Compartment()
  const readOnlySetting = new Compartment()
  const attributes = new Compartment()

  const languageNow = () => languageOf(mode, settings.completion)
  const readOnlyNow = () => EditorState.readOnly.of(settings.readOnly)
  const attributesNow = () => EditorView.contentAttributes.of({
    ...settings.attributes,
    // It is in the tab order as any editable element is; said outright, a checker sees that the scroller around it can be reached.
    'tabindex': '0',
    'spellcheck': 'false',
    'aria-readonly': String(settings.readOnly),
  })

  /** A text that arrives whole is checked at once; the delay is for one that is being typed. */
  function checkJson(view: EditorView) {
    if (mode !== 'json')
      return
    forceLinting(view)
    options.onValidity(validityOf(view))
  }

  const extensions: Extension = [
    hasLineNumbers(mode) ? [lineNumbers(), highlightActiveLineGutter()] : [],
    problemSupport(mode),
    completionOf(mode),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    search({ top: true }),
    EditorState.phrases.of(SEARCH_WORDS),
    EditorView.lineWrapping,
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    hankoLook,
    sizeLook[options.size],
    language.of(languageNow()),
    readOnlySetting.of(readOnlyNow()),
    attributes.of(attributesNow()),
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          options.onSave()
          return true
        },
      },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged)
        return
      if (mode === 'json')
        options.onValidity(validityOf(update.view))
      if (!update.transactions.some(transaction => transaction.annotation(fromCaller)))
        options.onChange(update.state.doc.toString())
    }),
  ]

  const stateOf = (text: string) => EditorState.create({ doc: text, extensions })
  const view = new EditorView({ parent: options.parent, state: stateOf(options.text) })
  const documents = new Map<string, EditorState>()
  let shown = options.document

  const markProblem = () => view.dispatch(setDiagnostics(view.state, diagnosticsOf(settings.problem, view.state.doc)))

  function setText(text: string) {
    if (text !== view.state.doc.toString())
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, annotations: fromCaller.of(true) })
  }

  function putCursorAt(position: number) {
    view.dispatch({ selection: { anchor: clamp(position, 0, view.state.doc.length) }, scrollIntoView: true })
    view.focus()
  }

  if (settings.problem)
    markProblem()
  checkJson(view)

  return {
    setText,
    /** Shows another document. The one that leaves keeps its undo history and its cursor for when it is shown again. */
    show(document: string, text: string) {
      documents.set(shown, view.state)
      shown = document
      view.setState(documents.get(document) ?? stateOf(text))
      view.dispatch({ effects: [language.reconfigure(languageNow()), readOnlySetting.reconfigure(readOnlyNow()), attributes.reconfigure(attributesNow())] })
      setText(text)
      markProblem()
      checkJson(view)
    },
    setReadOnly(readOnly: boolean) {
      settings.readOnly = readOnly
      view.dispatch({ effects: [readOnlySetting.reconfigure(readOnlyNow()), attributes.reconfigure(attributesNow())] })
    },
    setAttributes(next: Record<string, string>) {
      settings.attributes = next
      view.dispatch({ effects: attributes.reconfigure(attributesNow()) })
    },
    setCompletion(completion: LiquidCompletion) {
      settings.completion = completion
      view.dispatch({ effects: language.reconfigure(languageNow()) })
    },
    setProblem(problem: CodeProblem | null) {
      settings.problem = problem
      markProblem()
    },
    focus: () => view.focus(),
    goToLine: (line: number) => putCursorAt(lineAt(view.state.doc, line).from),
    goToProblem() {
      const [marked] = diagnosticsOf(settings.problem, view.state.doc)
      if (marked)
        putCursorAt(marked.from)
      else
        view.focus()
    },
    destroy: () => view.destroy(),
  }
}
