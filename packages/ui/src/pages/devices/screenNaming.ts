/** A Screen's name as the admin reads it. A Screen saved without one still needs something to be called by. */
export function screenName(name: string | null | undefined) {
  return name?.trim() || 'Unnamed Screen'
}

export const screenNameProblem = (name: string) => name.trim() ? undefined : 'A Screen needs a name.'

/** An HTML Screen's one invalid value, on Add Screen and on Edit HTML alike. */
export const htmlProblem = (html: string) => html.trim() ? undefined : 'Write the HTML this Screen is rendered from.'

export const possessive = (name: string) => `${name}'s`
