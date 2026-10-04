/** A Screen's name as the admin reads it. A Screen saved without one still needs something to be called by. */
export function screenName(name: string | null | undefined) {
  return name?.trim() || 'Unnamed Screen'
}

export const screenNameProblem = (name: string) => name.trim() ? undefined : 'A Screen needs a name.'

export const possessive = (name: string) => `${name}'s`
