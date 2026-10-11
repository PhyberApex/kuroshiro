export interface ScreenShellTarget {
  model: { cssClasses: string[], cssVariables: Record<string, string> }
  palette: { frameworkClass: string }
}

/**
 * The exact TRMNL framework version this Instance pins (ADR-0041), bumped by
 * Renovate's custom regex manager from `usetrmnl/trmnl-framework` releases.
 */
export const TRMNL_FRAMEWORK_VERSION = '3.4.0'

/**
 * Class list for the `.screen` element the TRMNL framework sizes and scales:
 * the model's own classes (device, size tier, density) and the palette's
 * bit-depth class. No orientation modifier is emitted here — plugins.css's
 * `screen--portrait` swaps the device's own w/h variables and is unrelated to
 * `model.rotation`, which is the post-render image rotation for panels whose
 * framebuffer is portrait (landscape-classed models can have `rotation: 90`).
 */
export function screenClasses({ model, palette }: ScreenShellTarget): string[] {
  return ['screen', ...model.cssClasses, palette.frameworkClass]
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
export function wrapInScreenShell(target: ScreenShellTarget, bodyHtml: string, frameworkVersion: string): string {
  const style = screenStyle(target)
  return `<html>
  <head>
    <link rel="stylesheet" href="https://trmnl.com/css/${frameworkVersion}/plugins.css">
    <script src="https://trmnl.com/js/${frameworkVersion}/plugins.js"></script>
  </head>
  <body class="environment trmnl">
    <div class="${screenClasses(target).join(' ')}"${style ? ` style="${style}"` : ''}>${bodyHtml}</div>
  </body>
</html>`
}
