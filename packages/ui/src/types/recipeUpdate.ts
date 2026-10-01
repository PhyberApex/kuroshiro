export type UpdateItemKind = 'added' | 'changed' | 'removed'

export type UpdateItemType = 'name' | 'description' | 'refreshInterval' | 'template' | 'dataSource' | 'field'

export type RecipeUpdateMode = 'two-way' | 'three-way'

export interface NormalizedDataSource {
  mode: 'fetch' | 'literal'
  method?: string
  url?: string | null
  headers?: Record<string, string>
  body?: Record<string, unknown>
  transformJs?: string | null
  literalValue?: Record<string, unknown> | unknown[] | string | number | boolean | null
}

export interface NormalizedTemplate {
  layout: string
  liquidMarkup: string
}

export interface NormalizedField {
  keyname: string
  fieldType: string
  name: string
  description: string | null
  defaultValue: string | null
  required: boolean
  order: number
}

export interface UpdateItem {
  kind: UpdateItemKind
  conflict: boolean
  itemType: UpdateItemType
  key: string
  local?: unknown
  upstream?: unknown
  snapshot?: unknown
}

export interface AssignmentsMissingRequiredField {
  key: string
  assignments: Array<{ deviceId: string, deviceName: string }>
}

export interface RecipeUpdatePreview {
  contentHash: string
  mode: RecipeUpdateMode
  items: UpdateItem[]
  assignmentsMissingRequiredField: AssignmentsMissingRequiredField[]
}

export interface RecipeUpdateSelection {
  itemType: UpdateItemType
  key: string
}

export interface ApplyRecipeUpdatePayload {
  contentHash: string
  apply: RecipeUpdateSelection[]
}
