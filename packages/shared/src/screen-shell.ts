export interface ScreenShellTarget {
  model: { cssClasses: string[], cssVariables: Record<string, string> }
  palette: { frameworkClass: string }
}

/** The modifiers TRMNL applies to the `.screen` element from a Plugin's settings (ADR-0054). */
export interface ScreenModifiers {
  /** `screen--no-bleed`: the views reach the panel's edge. */
  noScreenPadding?: boolean
  /** `screen--dark-mode`: ink and paper swapped. */
  darkMode?: boolean
}

const NO_MODIFIERS: ScreenModifiers = {}

/**
 * The exact TRMNL framework version this Instance pins (ADR-0041), bumped by
 * Renovate's custom regex manager from `usetrmnl/trmnl-framework` releases.
 */
export const TRMNL_FRAMEWORK_VERSION = '3.4.3'

/** An exact `X.Y.Z` release; never `latest`, a range or a `v` prefix (ADR-0041). */
export const FRAMEWORK_VERSION_PATTERN = /^\d+\.\d+\.\d+$/

/** A Plugin's own Framework Version if it has one, else the Instance pin. */
export function effectiveFrameworkVersion(pluginVersion: string | null | undefined): string {
  return pluginVersion || TRMNL_FRAMEWORK_VERSION
}

/**
 * Class list for the `.screen` element the TRMNL framework sizes and scales:
 * the model's own classes (device, size tier, density) and the palette's
 * bit-depth class. No orientation modifier is emitted here — plugins.css's
 * `screen--portrait` swaps the device's own w/h variables and is unrelated to
 * `model.rotation`, which is the post-render image rotation for panels whose
 * framebuffer is portrait (landscape-classed models can have `rotation: 90`).
 */
export function screenClasses({ model, palette }: ScreenShellTarget, { noScreenPadding, darkMode }: ScreenModifiers = NO_MODIFIERS): string[] {
  return ['screen', ...model.cssClasses, palette.frameworkClass, ...(noScreenPadding ? ['screen--no-bleed'] : []), ...(darkMode ? ['screen--dark-mode'] : [])]
}

/**
 * Inline fallback for models' CSS variables. Kept as an inline `style` (not
 * just the model's CSS class) so sizing still works for models missing from
 * the loaded plugins.css version — but this also means it overrides any
 * `screen--portrait` swap, since inline styles beat class-based rules.
 */
export function screenStyle({ model }: ScreenShellTarget): string {
  return Object.entries(model.cssVariables).map(([name, value]) => `${name}: ${value};`).join(' ')
}

export function viewFull(innerHtml: string): string {
  return `<div class="view view--full">${innerHtml}</div>`
}

/**
 * Wraps screen body markup (a `.view` or `.mashup` element) in the full HTML
 * document a device's image is rendered from. `frameworkVersion` is an input
 * (ADR-0041) rather than a constant read here, so the API and the UI build
 * the same `<head>` from whichever version the caller resolved.
 */
export function wrapInScreenShell(target: ScreenShellTarget, bodyHtml: string, frameworkVersion: string, modifiers: ScreenModifiers = NO_MODIFIERS): string {
  const style = screenStyle(target)
  return `<html>
  <head>
    <link rel="stylesheet" href="https://trmnl.com/css/${frameworkVersion}/plugins.css">
    <script src="https://trmnl.com/js/${frameworkVersion}/plugins.js"></script>
  </head>
  <body class="environment trmnl">
    <div class="${screenClasses(target, modifiers).join(' ')}"${style ? ` style="${style}"` : ''}>${bodyHtml}</div>
  </body>
</html>`
}
