/** The sentence a failed action left behind, or nothing when it left none. What throws decides the wording. */
export function failureReason(error: unknown): string | undefined {
  if (error instanceof Error)
    return error.message || undefined
  return typeof error === 'string' && error ? error : undefined
}
