/** Names as a sentence lists them: "Kitchen", "Kitchen and Hallway", "Kitchen, Hallway and Study". */
export function listed(names: string[]) {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
