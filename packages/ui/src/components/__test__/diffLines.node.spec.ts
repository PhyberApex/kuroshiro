import { describe, expect, it } from 'vitest'
import { diffLines, foldRuns } from '../diffLines'

describe('diffLines', () => {
  it('keeps the lines both sides share and says what was removed and added in between', () => {
    expect(diffLines(['<div>', '  {{ temp }}°', '</div>'], ['<div>', '  {{ temp }}{{ unit }}', '  {{ feels }}', '</div>'])).toEqual([
      { kind: 'same', text: '<div>' },
      { kind: 'removed', text: '  {{ temp }}°' },
      { kind: 'added', text: '  {{ temp }}{{ unit }}' },
      { kind: 'added', text: '  {{ feels }}' },
      { kind: 'same', text: '</div>' },
    ])
  })

  it('makes a one-line value one removed and one added line', () => {
    expect(diffLines(['every 15 minutes'], ['every 30 minutes'])).toEqual([
      { kind: 'removed', text: 'every 15 minutes' },
      { kind: 'added', text: 'every 30 minutes' },
    ])
  })

  it('reads a side that is not there as no lines', () => {
    expect(diffLines([], ['a'])).toEqual([{ kind: 'added', text: 'a' }])
    expect(diffLines(['a'], [])).toEqual([{ kind: 'removed', text: 'a' }])
  })
})

describe('foldRuns', () => {
  const same = (count: number, from = 1) => Array.from({ length: count }, (_, index) => ({ kind: 'same' as const, text: `line ${from + index}` }))

  it('folds a long run of unchanged lines, keeping two on each side of a change', () => {
    const lines = [{ kind: 'removed' as const, text: 'old' }, ...same(8), { kind: 'added' as const, text: 'new' }]

    expect(foldRuns(lines)).toEqual([
      { kind: 'removed', text: 'old' },
      ...same(2),
      { kind: 'folded', lines: same(4, 3) },
      ...same(2, 7),
      { kind: 'added', text: 'new' },
    ])
  })

  it('keeps two unchanged lines before the first change and after the last one', () => {
    expect(foldRuns([...same(5), { kind: 'added', text: 'new' }, ...same(5, 6)])).toEqual([
      { kind: 'folded', lines: same(3) },
      ...same(2, 4),
      { kind: 'added', text: 'new' },
      ...same(2, 6),
      { kind: 'folded', lines: same(3, 8) },
    ])
  })

  it('does not fold a run that is no longer than what it would keep', () => {
    const lines = [{ kind: 'removed' as const, text: 'old' }, ...same(5), { kind: 'added' as const, text: 'new' }]

    expect(foldRuns(lines)).toEqual(lines)
  })
})
