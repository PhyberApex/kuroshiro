import { resetViewport, resizeTo } from './viewport'

/** Phone, the widest phone layout below the 820 px breakpoint, and desktop. */
const OVERFLOW_WIDTHS = [375, 768, 1280] as const

function describeElement(element: Element) {
  const classes = [...element.classList].map(name => `.${name}`).join('')
  return `<${element.localName}${classes}> ends at ${Math.round(element.getBoundingClientRect().right)}px`
}

function overflowAt(width: number) {
  const root = document.documentElement
  if (root.scrollWidth <= root.clientWidth)
    return []
  const culprits = [...document.body.querySelectorAll('*')]
    .filter(element => element.getBoundingClientRect().right > root.clientWidth)
    .map(describeElement)
  return [`Horizontal overflow at ${width}px: the page is ${root.scrollWidth}px wide.\n${culprits.map(line => `  ${line}`).join('\n')}`]
}

/** Fails when what is mounted scrolls sideways at 375, 768 or 1280 px. Leaves the page at desktop width. */
export async function expectNoHorizontalOverflow() {
  const failures = await OVERFLOW_WIDTHS.reduce<Promise<string[]>>(
    async (earlier, width) => {
      const found = await earlier
      await resizeTo(width)
      return [...found, ...overflowAt(width)]
    },
    Promise.resolve([]),
  )
  await resetViewport()
  if (failures.length > 0)
    throw new Error(failures.join('\n\n'))
}
