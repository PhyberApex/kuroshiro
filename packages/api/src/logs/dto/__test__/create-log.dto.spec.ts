import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { CreateLogDto } from '../create-log.dto.js'

async function violations(payload: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateLogDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  return errors.flatMap(error => Object.values(error.constraints ?? {}))
}

const currentEntry = {
  created_at: 1790619540,
  id: 4211,
  message: 'boot',
  level: 'error',
}

const legacyEntry = {
  creation_timestamp: 1790619540,
  log_id: 4211,
  log_message: 'boot',
}

describe('create-log dto', () => {
  it('accepts the current envelope: { logs: [...] }', async () => {
    expect(await violations({ logs: [currentEntry] })).toEqual([])
  })

  it('accepts the legacy envelope: { log: { logs_array: [...] } }', async () => {
    expect(await violations({ log: { logs_array: [legacyEntry] } })).toEqual([])
  })

  it('rejects a body with neither envelope', async () => {
    expect(await violations({})).not.toEqual([])
  })

  it('rejects a body carrying an unknown top-level key', async () => {
    const errors = await violations({ logs: [currentEntry], extra: 'nope' })
    expect(errors.some(message => message.includes('should not exist'))).toBe(true)
  })

  it('rejects logs that is not an array', async () => {
    expect(await violations({ logs: currentEntry })).not.toEqual([])
  })

  it('rejects logs entries that are not objects', async () => {
    expect(await violations({ logs: ['not-an-object'] })).not.toEqual([])
  })

  it('rejects a log envelope missing logs_array', async () => {
    expect(await violations({ log: {} })).not.toEqual([])
  })

  it('rejects a log envelope whose logs_array is not an array of objects', async () => {
    expect(await violations({ log: { logs_array: ['nope'] } })).not.toEqual([])
  })
})
