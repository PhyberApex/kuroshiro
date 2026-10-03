import type { Result } from 'axe-core'
import type { Theme } from './theme'
import axe from 'axe-core'
import { forceTheme, THEMES } from './theme'

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function describeViolation({ id, help, nodes }: Result) {
  return [`  ${id}: ${help}`, ...nodes.map(node => `    ${node.html}`)].join('\n')
}

async function violationsIn(theme: Theme, target: Element) {
  await forceTheme(theme)
  const { violations } = await axe.run(target, { runOnly: { type: 'tag', values: WCAG_21_AA } })
  return violations.length > 0
    ? [`${violations.length} accessibility violation(s) in the ${theme} theme:\n${violations.map(describeViolation).join('\n')}`]
    : []
}

/**
 * Runs axe-core at WCAG 2.1 AA on what is mounted, once in each theme, and fails on any
 * violation. Leaves the page in the light theme.
 */
export async function expectAccessible(target: Element = document.body) {
  const failures = await THEMES.reduce<Promise<string[]>>(
    async (earlier, theme) => [...await earlier, ...await violationsIn(theme, target)],
    Promise.resolve([]),
  )
  await forceTheme('light')
  if (failures.length > 0)
    throw new Error(failures.join('\n\n'))
}
