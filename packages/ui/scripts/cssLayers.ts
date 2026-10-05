const LAYER_ORDER = 'reset, base, components'

/**
 * The first place a cascade layer is named fixes its order. A production build can put a component's
 * `@layer components` rules ahead of `styles/index.css`, which would let the reset override every component,
 * so the page itself must name the order before its first stylesheet.
 */
export function layerOrderProblem(html: string): string | null {
  const order = /<style>\s*@layer ([^;\s][^;]*);\s*<\/style>/.exec(html)
  if (!order)
    return `index.html does not declare the cascade layer order (<style>@layer ${LAYER_ORDER};</style>).`
  if (order[1]!.split(',').map(name => name.trim()).join(', ') !== LAYER_ORDER)
    return `index.html declares the layers as "${order[1]}", not "${LAYER_ORDER}".`
  const stylesheet = html.search(/<link[^>]+rel="stylesheet"/)
  if (stylesheet !== -1 && stylesheet < order.index)
    return 'index.html links a stylesheet before the layer order is declared.'
  return null
}
