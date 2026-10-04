/** The sentence a failed action left behind, or nothing when it left none. What throws decides the wording. */
export function failureReason(error: unknown): string | undefined {
  if (error instanceof Error)
    return error.message || undefined
  return typeof error === 'string' && error ? error : undefined
}

/** "Not saved." and, when the failure gave one, its reason. */
export function notSavedSentence(reason?: string) {
  return reason ? `Not saved. ${reason}` : 'Not saved.'
}
