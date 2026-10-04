/** The icon set, drawn solid with square ends on a 16 px grid. A new icon is drawn here; no icon library is added. */
export const ICON_PATHS = {
  grip: 'M5 3h2v2H5zM9 3h2v2H9zM5 7h2v2H5zM9 7h2v2H9zM5 11h2v2H5zM9 11h2v2H9z',
  chevron: 'M3.2 5.4 8 10.2l4.8-4.8 1.1 1.1L8 12.4 2.1 6.5z',
  up: 'M8 3.2 2.6 8.6l1.1 1.1L8 5.4l4.3 4.3 1.1-1.1z',
  down: 'M8 12.8 2.6 7.4l1.1-1.1L8 10.6l4.3-4.3 1.1 1.1z',
  close: 'M3.6 2.5 8 6.9l4.4-4.4 1.1 1.1L9.1 8l4.4 4.4-1.1 1.1L8 9.1l-4.4 4.4-1.1-1.1L6.9 8 2.5 3.6z',
  check: 'M6.2 10.6 12.9 3.9 14 5l-7.8 7.8L2 8.6l1.1-1.1z',
  plus: 'M7.2 2.5h1.6v4.7h4.7v1.6H8.8v4.7H7.2V8.8H2.5V7.2h4.7z',
  copy: 'M5 1.5h9.5V11H13V3H5zM1.5 5H11v9.5H1.5zM3 6.5V13h6.5V6.5z',
  external: 'M2.5 3.5H7V5H4v7h7V9h1.5v4.5h-10zM9 2.5h4.5V7H12V5.06L7.53 9.53 6.47 8.47 10.94 4H9z',
  search: 'M7 2.25a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5zm0 1.5a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5zM10.9 9.8l3.4 3.4-1.1 1.1-3.4-3.4z',
  upload: 'M8 2 3.6 6.4l1.1 1.1 2.5-2.5V11h1.6V5l2.5 2.5 1.1-1.1zM2.5 12.5h11V14h-11z',
  problem: 'M2 2h12v12H2zM7.2 4.5v4.6h1.6V4.5zM7.2 10.2v1.6h1.6v-1.6z',
  more: 'M2.5 7h2v2h-2zM7 7h2v2H7zM11.5 7h2v2h-2z',
} as const

export type IconName = keyof typeof ICON_PATHS

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[]
