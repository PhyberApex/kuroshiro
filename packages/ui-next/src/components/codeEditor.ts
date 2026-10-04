export type CodeEditorMode = 'liquid' | 'html' | 'json' | 'javascript'

/** `bench` is 27 rem high beside the preview (20 rem on phone), `full-window` fills its place, `code-input` is as high as its text inside a form. */
export type CodeEditorSize = 'bench' | 'full-window' | 'code-input'

/** A problem the caller found. With a line it is marked in the code and the gutter; `from` and `to` (offsets into the text) narrow the mark to a place in it. */
export interface CodeProblem {
  message: string
  line: number | null
  from?: number
  to?: number
}

/** Whether the text of a JSON editor parses, with the parser's own message when it does not. */
export interface CodeValidity {
  valid: boolean
  message: string | null
}

export const MODE_LABELS: Record<CodeEditorMode, string> = {
  liquid: 'Liquid and HTML',
  html: 'HTML',
  json: 'JSON',
  javascript: 'JavaScript',
}
