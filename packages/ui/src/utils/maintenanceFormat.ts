export function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`
}

export function formatAge(hours: number): string {
  if (hours < 24)
    return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
