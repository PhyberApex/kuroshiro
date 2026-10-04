import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useSaveAsChanged } from '../useSaveAsChanged'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets the promise chain of a save that has just settled run. */
const settle = () => vi.advanceTimersByTimeAsync(0)

describe('save as changed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is idle until something is committed', () => {
    const save = vi.fn()
    const saving = useSaveAsChanged(save, ref('Kitchen'))

    expect(saving.status).toBe('idle')
    expect(save).not.toHaveBeenCalled()
  })

  it('is saving while the save runs, and hands it what the admin entered', async () => {
    const answer = deferred<string>()
    const save = vi.fn(() => answer.promise)
    const name = ref('Kitchen')
    const saving = useSaveAsChanged(save, name)

    name.value = 'Hallway'
    saving.commit()

    expect(saving.status).toBe('saving')
    expect(save).toHaveBeenCalledExactlyOnceWith('Hallway')
  })

  it('is saved for 2 seconds after the save, then idle again', async () => {
    const saving = useSaveAsChanged(async (value: string) => value, ref('Hallway'))

    saving.commit()
    await settle()
    expect(saving.status).toBe('saved')

    await vi.advanceTimersByTimeAsync(1999)
    expect(saving.status).toBe('saved')

    await vi.advanceTimersByTimeAsync(1)
    expect(saving.status).toBe('idle')
  })

  it('replaces the value with the server\'s answer', async () => {
    const name = ref('  Hallway ')
    const saving = useSaveAsChanged(async (value: string) => value.trim(), name)

    saving.commit()
    await settle()

    expect(name.value).toBe('Hallway')
  })

  it('leaves the value alone when the server answers with nothing', async () => {
    const name = ref('Hallway')
    const saving = useSaveAsChanged(async () => {}, name)

    saving.commit()
    await settle()

    expect(name.value).toBe('Hallway')
    expect(saving.status).toBe('saved')
  })

  it('does not overwrite what the admin typed while the save ran', async () => {
    const answer = deferred<string>()
    const name = ref('Hallway')
    const saving = useSaveAsChanged(() => answer.promise, name)

    saving.commit()
    name.value = 'Hallway, upstairs'
    answer.resolve('Hallway')
    await settle()

    expect(name.value).toBe('Hallway, upstairs')
  })

  it('is not saved, with the reason and the entered value kept, when the save fails', async () => {
    const name = ref('Hallway')
    const saving = useSaveAsChanged(async () => {
      throw new Error('A Device with this name already exists.')
    }, name)

    saving.commit()
    await settle()

    expect(saving.status).toBe('failed')
    expect(saving.reason).toBe('A Device with this name already exists.')
    expect(name.value).toBe('Hallway')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(saving.status).toBe('failed')
  })

  it('forgets a failed save when the value is replaced from outside, and lets a save still under way pass unnoticed', async () => {
    const name = ref('Hallway')
    const saving = useSaveAsChanged(async () => {
      throw new Error('A Device with this name already exists.')
    }, name)

    saving.commit()
    await settle()
    saving.reset()

    expect(saving.status).toBe('idle')
    expect(saving.reason).toBeUndefined()

    saving.commit()
    saving.reset()
    await settle()

    expect(saving.status).toBe('idle')
  })

  it('repeats the last save on "Try again"', async () => {
    const save = vi.fn<(value: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('Kuroshiro\'s server is not answering.'))
      .mockImplementation(async value => value)
    const name = ref('Hallway')
    const saving = useSaveAsChanged(save, name)

    saving.commit()
    await settle()
    saving.retry()
    expect(saving.status).toBe('saving')
    expect(saving.reason).toBeUndefined()
    await settle()

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('Hallway')
    expect(saving.status).toBe('saved')
  })

  it('lets only the newest save decide the state', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const save = vi.fn<(value: string) => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const name = ref('Hall')
    const saving = useSaveAsChanged(save, name)

    saving.commit()
    name.value = 'Hallway'
    saving.commit()
    first.reject(new Error('too slow'))
    await settle()
    expect(saving.status).toBe('saving')

    second.resolve('Hallway')
    await settle()
    expect(saving.status).toBe('saved')
    expect(name.value).toBe('Hallway')
  })

  it('starts the 2 seconds again for a save that follows a save', async () => {
    const saving = useSaveAsChanged(async (value: string) => value, ref('Hallway'))

    saving.commit()
    await settle()
    await vi.advanceTimersByTimeAsync(1500)
    saving.commit()
    await settle()
    await vi.advanceTimersByTimeAsync(1500)

    expect(saving.status).toBe('saved')
  })

  it('drops its timer with the component that used it', async () => {
    const scope = effectScope()
    const saving = scope.run(() => useSaveAsChanged(async (value: string) => value, ref('Hallway')))!

    saving.commit()
    await settle()
    scope.stop()

    expect(vi.getTimerCount()).toBe(0)
  })
})
