const INK = '#0a0a0a'

function rect(x: number, y: number, width: number, height: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`
}

/**
 * A stand-in for a Screen image at any panel size: a date block, a rule and lines of entries,
 * drawn as rectangles so it looks the same whatever faces a machine has.
 */
export function screenArt(width: number, height: number) {
  const unit = Math.min(width, height) / 12
  const column = width / 3
  const lines = Array.from({ length: Math.max(1, Math.floor((height - 4 * unit) / (1.5 * unit))) }, (_, index) =>
    rect(column + unit, unit * (1.5 + index * 1.5), (width - column - 2 * unit) * (index % 3 === 1 ? 0.6 : 0.85), unit / 2))
  const shapes = [
    rect(unit, unit, column - 2 * unit, unit / 2),
    rect(unit, unit * 2.5, (column - 2 * unit) * 0.6, Math.min(height / 3, column - 2 * unit)),
    rect(column, unit, Math.max(1, unit / 8), height - 4 * unit),
    ...lines,
    rect(0, height - 2 * unit, width, Math.max(1, unit / 8)),
    rect(unit, height - 1.25 * unit, column / 2, unit / 2),
  ]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#fff"/><g fill="${INK}">${shapes.join('')}</g></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
