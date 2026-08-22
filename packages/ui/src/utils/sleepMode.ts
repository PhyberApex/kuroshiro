/** Converts seconds-since-midnight (the API's representation) to a `type="time"` input value. */
export function secondsToTimeInput(seconds: number | null | undefined): string {
  if (seconds == null)
    return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Converts a `type="time"` input value (`HH:MM`) to seconds-since-midnight. */
export function timeInputToSeconds(value: string): number | null {
  if (!value)
    return null
  const [hours, minutes] = value.split(':')
  return Number(hours) * 3600 + Number(minutes) * 60
}
