const PAINTED = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'fill'] as const

function sealColour() {
  const probe = document.body.appendChild(document.createElement('span'))
  probe.style.color = 'var(--color-seal)'
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

/**
 * The elements under `root` that are painted in the seal colour, in the theme that is forced
 * now. Red is rationed to the seal and a firing Alert, so a component that reports any other
 * trouble asserts that this is empty.
 */
export function elementsInSealColour(root: Element) {
  const seal = sealColour()
  return [...root.querySelectorAll('*')].filter((element) => {
    const style = getComputedStyle(element)
    return PAINTED.some(property => style[property] === seal)
  })
}
