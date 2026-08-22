import type { DeviceModel, Palette } from '../types'

export interface RenderTarget {
  model: DeviceModel
  palette: Palette
}

const TRMNL_FRAMEWORK_CSS = 'https://usetrmnl.com/css/latest/plugins.css'
const TRMNL_FRAMEWORK_JS = 'https://usetrmnl.com/js/latest/plugins.js'

/**
 * Mirrors the API's `screen-shell.ts` so previews match what the device
 * receives. No orientation class here — see the API copy for why
 * `model.rotation` doesn't map to `screen--portrait`/`screen--landscape`.
 */
export function screenClasses({ model, palette }: RenderTarget): string[] {
  return ['screen', ...model.cssClasses, palette.frameworkClass]
}

export function screenStyle({ model }: RenderTarget): string {
  return Object.entries(model.cssVariables).map(([name, value]) => `${name}: ${value};`).join(' ')
}

export function viewFull(innerHtml: string): string {
  return `<div class="view view--full">${innerHtml}</div>`
}

export function wrapInScreenShell(target: RenderTarget, bodyHtml: string): string {
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
