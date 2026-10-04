/** What is wrong with a Device's name as entered, or nothing. A name is what is left after trimming. */
export function deviceNameProblem(name: string) {
  return name.trim() ? undefined : 'A Device needs a name.'
}
