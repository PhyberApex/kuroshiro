export interface SelectOption<T extends string = string> {
  /** Never the empty string: Reka keeps that for "nothing chosen". */
  value: T
  label: string
  disabled?: boolean
  /** Why a disabled option cannot be chosen. It is shown in the list. */
  reason?: string
}

// Reka reads the layer off the content and puts it on the positioned wrapper it draws around it.
export const OPTION_LIST_LAYER = { zIndex: 'var(--layer-popover)' }

export const OPTION_LIST_GAP = 4
