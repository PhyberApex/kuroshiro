export function parseHeaderInt(value?: string | null): number | undefined {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isNaN(parsed) ? undefined : parsed
}
