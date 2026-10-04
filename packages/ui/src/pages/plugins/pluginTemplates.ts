import type { PluginDetail, TemplateInvalidDetails, TemplateProblem, TemplateSize } from 'kuroshiro-shared'
import type { FormRow } from './formRows'
import type { FieldProblem, PluginFormPart } from './pluginForm'
import { TEMPLATE_SIZES } from 'kuroshiro-shared'
import { isRefusal } from '@/api/client'
import { keptRows, sentPathsOf } from './formRows'

/** One Template as the editor holds it. A removed one stays, with "Put back", until the save. */
export interface TemplateRow extends FormRow {
  size: TemplateSize
  liquidMarkup: string
}

export interface TemplatesDraft {
  /** In the order of the sizes, Full first. */
  rows: TemplateRow[]
}

/** Liquid's own check of a Template, which arrives with the engine. */
export type CheckTemplate = (markup: string) => TemplateProblem | null

const inSizeOrder = (rows: TemplateRow[]) => TEMPLATE_SIZES.flatMap(size => rows.filter(row => row.size === size))

const rowOf = (size: TemplateSize, liquidMarkup: string): TemplateRow => ({ key: size, size, liquidMarkup, removed: false })

const rowsOf = (plugin: PluginDetail) => inSizeOrder(plugin.templates.map(template => rowOf(template.size, template.liquidMarkup)))

/** The path a save sends each Template's markup at; a removed Template is not sent and has none. */
export function templatePaths(rows: TemplateRow[]) {
  return sentPathsOf('templates', rows).map(path => path && `${path}.liquidMarkup`)
}

export const missingSizes = (rows: TemplateRow[]) => TEMPLATE_SIZES.filter(size => rows.every(row => row.size !== size))

/** The rows with a Template of `size` that starts as a copy of Full. */
export function withTemplateAdded(rows: TemplateRow[], size: TemplateSize) {
  const full = rows.find(row => row.size === 'full')
  return inSizeOrder([...rows, rowOf(size, full?.liquidMarkup ?? '')])
}

/** What the browser can say before the Liquid engine has arrived. The server words an empty Template the same way. */
const checkEmpty: CheckTemplate = markup => markup.trim() === '' ? { message: 'A template cannot be empty.', line: null } : null

function refusedTemplate(error: unknown, rows: TemplateRow[]): FieldProblem[] {
  if (!isRefusal(error, 'template-invalid'))
    return []
  const { size, line, message } = error.details as Partial<TemplateInvalidDetails>
  const path = templatePaths(rows)[rows.findIndex(row => row.size === size)]
  return path && message ? [{ path, message, line: line ?? null }] : []
}

/**
 * The part of the Plugin's form that the section "Template" edits. `check` answers Liquid's check once the engine
 * has been fetched; until then only an empty Template stops a save, and the server is the gate.
 */
export function templatesPart(check: () => CheckTemplate | undefined): PluginFormPart<TemplatesDraft> {
  return {
    keys: ['templates'],
    read: plugin => ({ rows: rowsOf(plugin) }),
    toInput: draft => ({ templates: keptRows(draft.rows).map(({ size, liquidMarkup }) => ({ size, liquidMarkup })) }),
    validate: ({ rows }) => {
      const paths = templatePaths(rows)
      return rows.flatMap((row, index) => {
        const path = paths[index]
        const problem = path ? (check() ?? checkEmpty)(row.liquidMarkup) : null
        return path && problem ? [{ path, ...problem }] : []
      })
    },
    refused: (error, draft) => refusedTemplate(error, draft.rows),
  }
}
