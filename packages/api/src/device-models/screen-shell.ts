import type { DeviceRenderTarget } from './device-models.service'

export const TRMNL_FRAMEWORK_CSS = 'https://usetrmnl.com/css/latest/plugins.css'
export const TRMNL_FRAMEWORK_JS = 'https://usetrmnl.com/js/latest/plugins.js'

/**
 * Class list for the `.screen` element the TRMNL framework sizes and scales:
 * the model's own classes (device, size tier, density), the palette's bit-depth
 * class and the orientation.
 */
export function screenClasses({ model, palette }: DeviceRenderTarget): string[] {
  return ['screen', ...model.cssClasses, palette.frameworkClass, model.rotation === 0 ? 'screen--landscape' : 'screen--portrait']
}

export function screenStyle({ model }: DeviceRenderTarget): string {
  return Object.entries(model.cssVariables).map(([name, value]) => `${name}: ${value};`).join(' ')
}

export function viewFull(innerHtml: string): string {
  return `<div class="view view--full">${innerHtml}</div>`
}

/**
 * Wraps screen body markup (a `.view` or `.mashup` element) in the full HTML
 * document a device's image is rendered from.
 */
export function wrapInScreenShell(target: DeviceRenderTarget, bodyHtml: string): string {
  const style = screenStyle(target)
  return `<html>
  <head>
    <link rel="stylesheet" href="${TRMNL_FRAMEWORK_CSS}">
    <script src="${TRMNL_FRAMEWORK_JS}"></script>
  </head>
  <body class="environment trmnl">
    <div class="${screenClasses(target).join(' ')}"${style ? ` style="${style}"` : ''}>${bodyHtml}</div>
  </body>
</html>`
}
