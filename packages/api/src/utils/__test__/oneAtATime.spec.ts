import { describe, expect, it } from 'vitest'
import { OneAtATime } from '../oneAtATime.js'

function deferred(): { promise: Promise<void>, resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('oneAtATime', () => {
  it('starts a key\'s work only once its earlier work has settled', async () => {
    const queue = new OneAtATime()
    const first = deferred()
    const started: string[] = []

    const one = queue.run('plugin-1', async () => {
      started.push('one')
      await first.promise
    })
    const two = queue.run('plugin-1', async () => {
      started.push('two')
    })
    await Promise.resolve()
    expect(started).toEqual(['one'])

    first.resolve()
    await Promise.all([one, two])
    expect(started).toEqual(['one', 'two'])
  })

  it('runs other keys alongside, and work without a key straight away', async () => {
    const queue = new OneAtATime()
    const blocked = deferred()
    const started: string[] = []

    const one = queue.run('plugin-1', async () => {
      await blocked.promise
    })
    await Promise.all([
      queue.run('plugin-2', async () => started.push('plugin-2')),
      queue.run(undefined, async () => started.push('no key')),
    ])
    expect(started).toEqual(expect.arrayContaining(['plugin-2', 'no key']))

    blocked.resolve()
    await one
  })

  it('runs the next work after earlier work failed, and hands the failure to its own caller', async () => {
    const queue = new OneAtATime()

    await expect(queue.run('plugin-1', async () => {
      throw new Error('render failed')
    })).rejects.toThrow('render failed')
    await expect(queue.run('plugin-1', async () => 'stored')).resolves.toBe('stored')
  })
})
