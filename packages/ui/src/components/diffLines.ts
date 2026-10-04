export interface DiffLine {
  kind: 'same' | 'removed' | 'added'
  text: string
}

export type DiffEntry = DiffLine | { kind: 'folded', lines: DiffLine[] }

/** The lengths of the longest common runs of `before[i..]` and `after[j..]`, for every `i` and `j`. */
function commonLengths(before: string[], after: string[]): number[][] {
  const lengths = Array.from({ length: before.length + 1 }, () => Array.from<number>({ length: after.length + 1 }).fill(0))
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i]![j] = before[i] === after[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }
  return lengths
}

/** A line diff along the longest common subsequence, removals before additions where both stand at one place. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const lengths = commonLengths(before, after)
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      lines.push({ kind: 'same', text: before[i++]! })
      j++
    }
    else if (j >= after.length || (i < before.length && lengths[i + 1]![j]! >= lengths[i]![j + 1]!)) {
      lines.push({ kind: 'removed', text: before[i++]! })
    }
    else {
      lines.push({ kind: 'added', text: after[j++]! })
    }
  }
  return lines
}

const KEPT_AROUND_A_CHANGE = 2
const FEWEST_FOLDED = 2

function foldRun(run: DiffLine[], keepBefore: number, keepAfter: number): DiffEntry[] {
  const hidden = run.length - keepBefore - keepAfter
  if (hidden < FEWEST_FOLDED)
    return run
  return [...run.slice(0, keepBefore), { kind: 'folded', lines: run.slice(keepBefore, run.length - keepAfter) }, ...run.slice(run.length - keepAfter)]
}

/** Folds each run of unchanged lines down to the two next to a change, unless that would hide fewer than two. */
export function foldRuns(lines: DiffLine[]): DiffEntry[] {
  const entries: DiffEntry[] = []
  let run: DiffLine[] = []
  const closeRun = (atEnd: boolean) => {
    const atStart = entries.length === 0
    entries.push(...foldRun(run, atStart ? 0 : KEPT_AROUND_A_CHANGE, atEnd ? 0 : KEPT_AROUND_A_CHANGE))
    run = []
  }
  for (const line of lines) {
    if (line.kind === 'same') {
      run.push(line)
      continue
    }
    closeRun(false)
    entries.push(line)
  }
  closeRun(true)
  return entries
}
