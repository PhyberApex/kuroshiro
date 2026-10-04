/** What every list of rows in the Plugin's form holds of a row, beside what the row edits. */
export interface FormRow {
  /** Tells the rows apart in the page: the id of a saved row, a counted one for a row that was added. */
  key: string
  /** Left out of the next save. The row stays, struck through, until then. */
  removed: boolean
}

export const keptRows = <Row extends FormRow>(rows: Row[]) => rows.filter(row => !row.removed)

/** The path a save sends each row at, by the row's place in the draft: a removed row is not sent and has none. */
export function sentPathsOf(collection: string, rows: FormRow[]): Array<string | undefined> {
  const kept = keptRows(rows)
  return rows.map(row => row.removed ? undefined : `${collection}.${kept.indexOf(row)}`)
}

const ADDED_KEY = /^added-(\d+)$/

/** The key of a row that is added: counted from the rows, so the same draft gives the same key. */
export function nextAddedKey(rows: FormRow[]) {
  const counted = rows.map(row => Number(ADDED_KEY.exec(row.key)?.[1] ?? 0))
  return `added-${Math.max(0, ...counted) + 1}`
}

/** `base`, or the first of `base_2`, `base_3` and so on that no row is called. */
export function freeName(base: string, taken: string[]) {
  const candidates = [base, ...taken.map((_, index) => `${base}_${index + 2}`), `${base}_${taken.length + 2}`]
  return candidates.find(name => !taken.includes(name))!
}
