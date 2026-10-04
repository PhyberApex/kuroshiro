import type { RouteLocationRaw } from 'vue-router'

interface RowMenuItemBase {
  /** The item as the admin reads it. It is also what tells two items apart. */
  label: string
  /** What the item stands for, beside its label and quieter: "top or bottom" beside "Half horizontal". It describes the item without being part of its name. */
  hint?: string
  disabled?: boolean
  /** Draws a rule above the item, to set what follows apart: "Delete Plugin" under "Duplicate" and "Export". */
  ruleAbove?: boolean
}

export interface RowMenuAction extends RowMenuItemBase {
  select: () => void
  /** Runs once the menu has closed, in place of giving the focus back to the menu's button: for an action that moves the focus itself. */
  afterClose?: () => void
}

export interface RowMenuLink extends RowMenuItemBase {
  to: RouteLocationRaw
}

export type RowMenuItem = RowMenuAction | RowMenuLink
