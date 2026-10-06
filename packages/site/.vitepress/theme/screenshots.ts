export const screenshots = {
  'devices': 'The Devices list: what each Device shows, when it was last seen, its battery and any Alert',
  'device-screens': 'A Device\'s Screens in their Order, with the Current Screen and each Screen\'s Schedule',
  'add-screen': 'Adding a Screen to a Device',
  'html-editor': 'The HTML editor, previewing the Screen for its Device as you type',
  'device-settings': 'A Device\'s Settings',
  'device-logs': 'A Device\'s logs, as reported by its firmware',
  'plugins': 'The Plugins list',
  'plugin': 'A Plugin: its Template with a live preview, Data Sources, Field Values, Devices and source Recipe',
  'alerts': 'The Alerts page: every active Alert, plus anything resolved in the last 7 days',
  'instance': 'The Instance pages',
  'connect': 'Connecting a Device: the server URL to enter on its Wi-Fi setup page',
} as const

export type ScreenshotName = keyof typeof screenshots

export function screenshotPath(name: ScreenshotName, scheme: 'light' | 'dark') {
  return `/screenshots/${name}-${scheme}.png`
}
