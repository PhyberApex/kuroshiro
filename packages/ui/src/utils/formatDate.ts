export function formatDate(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()

  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.round(diffMs / 1000)
  const diffMinutes = Math.round(diffSeconds / 60)
  const diffHours = Math.round(diffMinutes / 60)
  const diffDays = Math.round(diffHours / 24)

  let relative
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (Math.abs(diffSeconds) < 60) {
    relative = rtf.format(-diffSeconds, 'second')
  }
  else if (Math.abs(diffMinutes) < 60) {
    relative = rtf.format(-diffMinutes, 'minute')
  }
  else if (Math.abs(diffHours) < 24) {
    relative = rtf.format(-diffHours, 'hour')
  }
  else {
    relative = rtf.format(-diffDays, 'day')
  }

  // Format to UTC time (always show in UTC)
  const utcTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }).format(date)

  return `${relative} (${utcTime} UTC)`
}
