import type { RouteLocationRaw } from 'vue-router'

interface RowMenuItemBase {
  /** The item as the admin reads it. It is also what tells two items apart. */
  label: string
  disabled?: boolean
  /** Draws a rule above the item, to set what follows apart: "Delete Plugin" under "Duplicate" and "Export". */
  ruleAbove?: boolean
}

export interface RowMenuAction extends RowMenuItemBase {
  select: () => void
}

export interface RowMenuLink extends RowMenuItemBase {
  to: RouteLocationRaw
}

export type RowMenuItem = RowMenuAction | RowMenuLink
