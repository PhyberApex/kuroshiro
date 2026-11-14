const CONTROLS = 'a, button, input, select, textarea, label, [role="switch"]'

/**
 * The whole line of an accordion row opens it, as the name does, except where the line holds
 * a control of its own or the admin is selecting text. `trigger` is the button the name is.
 */
export function openFromLine(trigger: () => { click: () => void } | null | undefined) {
  return (event: MouseEvent) => {
    const pressed = event.target as Element
    if (pressed.closest(CONTROLS) || !getSelection()?.isCollapsed)
      return
    trigger()?.click()
  }
}
