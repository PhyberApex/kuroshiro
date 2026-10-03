import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { ICON_PATHS } from './icons'

const SOFT = 'var(--color-ink-soft)'
const INK = 'var(--color-ink)'
const PAPER = 'var(--color-paper)'

/** Syntax is told apart by weight, `ink-soft` and italics. No colour. */
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.brace, tags.processingInstruction], fontWeight: '700' },
  { tag: [tags.tagName, tags.propertyName, tags.definition(tags.variableName), tags.function(tags.variableName)], fontWeight: '600' },
  { tag: [tags.angleBracket, tags.string, tags.attributeValue, tags.punctuation, tags.separator], color: SOFT },
  { tag: [tags.comment, tags.blockComment, tags.lineComment], color: SOFT, fontStyle: 'italic' },
  { tag: [tags.bool, tags.null, tags.atom], fontWeight: '600' },
])

const problemIcon = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill-rule="evenodd" d="${ICON_PATHS.problem}"/></svg>') center / contain no-repeat`

const button = {
  minHeight: 'var(--control-height)',
  margin: '0',
  padding: '0 var(--space-3)',
  border: `1px solid ${INK}`,
  borderRadius: 'var(--radius)',
  backgroundImage: 'none',
  backgroundColor: PAPER,
  color: INK,
  fontFamily: 'var(--font-text)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-semibold)',
  textTransform: 'none',
  cursor: 'pointer',
}

/*
CodeMirror writes its styles outside the cascade layers, so its look is set here, as one of its
themes built from the tokens, and not in a component's scoped styles.
*/
const theme = EditorView.theme({
  '&': { color: INK, backgroundColor: PAPER, fontSize: 'var(--code-size)' },
  '&.cm-focused': { outline: 'none' },
  // Where motion is reduced every property still transitions for 0.01 ms, so a style lands a frame after CodeMirror has measured its lines and the gutter is laid out from the old one.
  '&, & *': { transitionProperty: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: 'var(--code-leading)', scrollbarWidth: 'thin', scrollbarColor: `${SOFT} transparent` },
  '.cm-content': { padding: 'var(--code-pad) 0', caretColor: INK },
  '.cm-line': { padding: '0 var(--space-3)' },

  '.cm-gutters': { backgroundColor: PAPER, color: SOFT, border: 'none', borderRight: 'var(--rule)' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '1.75rem', padding: '0 var(--space-2)', fontSize: '0.6875rem', lineHeight: 'inherit' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: INK, fontWeight: '700' },

  '.cm-cursor, .cm-dropCursor': { borderLeft: `2px solid ${INK}` },
  '.cm-selectionBackground': { background: 'var(--color-line)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { background: INK },
  // The selection's ground is drawn by CodeMirror under the text; the text on it is turned paper by the browser's own selection.
  '&.cm-focused .cm-line::selection, &.cm-focused .cm-line ::selection': { color: PAPER },

  '.cm-liquid': { padding: '1px 0', borderRadius: 'var(--radius-inner)', backgroundColor: 'var(--color-wash)' },
  '.cm-matchingBracket, .cm-nonmatchingBracket': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'transparent', outline: `1px solid ${INK}` },
  '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'transparent' },

  '.cm-gutter-lint': { width: '1.125rem' },
  '.cm-gutter-lint .cm-gutterElement': { display: 'flex', alignItems: 'center', padding: '0 0 0 var(--space-1)' },
  '.cm-lint-marker': { width: '0.875rem', height: '0.875rem' },
  '.cm-lint-marker-error': { content: 'normal', background: INK, mask: problemIcon },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: `underline double ${INK}`, textUnderlineOffset: '3px' },
  '.cm-lintPoint-error:after': { borderBottomColor: INK },
  '.cm-diagnostic': { padding: 'var(--space-2) var(--space-3)', borderLeft: 'none' },

  '.cm-tooltip': { zIndex: 'var(--layer-popover)', border: `1px solid ${INK}`, borderRadius: 'var(--radius)', backgroundColor: PAPER, color: INK, fontSize: 'var(--text-xs)' },
  '.cm-tooltip-lint': { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { maxHeight: '14rem', padding: 'var(--space-1)', fontFamily: 'var(--font-mono)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '2px var(--space-2)', borderRadius: 'var(--radius-inner)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: INK, color: PAPER },
  '.cm-completionDetail': { marginLeft: 'var(--space-3)', color: SOFT, fontStyle: 'normal' },
  '.cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail': { color: 'inherit' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '700' },

  '.cm-panels': { backgroundColor: PAPER, color: INK, fontFamily: 'var(--font-text)', fontSize: 'var(--text-sm)' },
  '.cm-panels.cm-panels-top': { borderBottom: 'var(--rule)' },
  '.cm-panel.cm-search': { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--control-height) var(--space-2) var(--space-3)' },
  '.cm-panel.cm-search br': { flexBasis: '100%', height: '0', content: '""' },
  '.cm-panel.cm-search label': { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', minHeight: 'var(--control-height)', margin: '0', fontSize: 'var(--text-sm)' },
  '.cm-panel.cm-search input[type=checkbox]': { margin: '0' },
  '.cm-panel.cm-search [name=close]': { top: '0', right: '0', width: 'var(--control-height)', height: 'var(--control-height)', padding: '0', color: INK, fontSize: '1.125rem', cursor: 'pointer' },
  '.cm-textfield': { minHeight: 'var(--control-height)', margin: '0', padding: '0 var(--space-2)', border: 'var(--rule-control)', borderRadius: 'var(--radius)', backgroundColor: PAPER, color: INK, fontFamily: 'var(--font-mono)', fontSize: 'var(--code-field-size)' },
  '.cm-textfield::placeholder': { color: SOFT, opacity: '1' },
  '.cm-textfield:hover': { borderColor: INK },
  '.cm-button': button,
  '.cm-button:hover': { backgroundColor: 'var(--color-wash)' },
  '.cm-button:active': { backgroundImage: 'none', backgroundColor: 'var(--color-line)' },
  '.cm-searchMatch': { backgroundColor: 'transparent', outline: `1px solid ${SOFT}` },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--color-line)', outline: `1px solid ${INK}` },
})

const fillsItsFrame = EditorView.theme({ '&': { height: '100%' } })

/** As high as its text: from three lines to 15 rem, then it scrolls. */
const growsWithItsText = EditorView.theme({
  '&': { maxHeight: '15rem' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-content, .cm-gutter': { minHeight: 'calc(3 * var(--code-leading) * 1em + 2 * var(--code-pad))' },
})

export const hankoLook = [theme, syntaxHighlighting(highlight)]

export const sizeLook = {
  'bench': fillsItsFrame,
  'full-window': fillsItsFrame,
  'code-input': growsWithItsText,
} as const
