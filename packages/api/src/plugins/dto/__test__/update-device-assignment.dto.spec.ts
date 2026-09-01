import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { UpdateDeviceAssignmentDto } from '../update-device-assignment.dto.js'

async function violations(payload: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateDeviceAssignmentDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  return errors.flatMap(error => Object.values(error.constraints ?? {}))
}

describe('update-device-assignment dto', () => {
  it('accepts isActive and order alone', async () => {
    expect(await violations({ isActive: false })).toEqual([])
    expect(await violations({ order: 3 })).toEqual([])
    expect(await violations({ isActive: true, order: 0 })).toEqual([])
  })

  it('rejects a body carrying fields outside isActive/order, matching the mass-assignment guard on the route', async () => {
    const errors = await violations({ id: 'other-device-plugin', order: 3 })

    expect(errors.some(message => message.includes('should not exist'))).toBe(true)
  })

  it('rejects an attempt to smuggle a plugin/device relation through the update', async () => {
    const errors = await violations({ plugin: { id: 'other-plugin' } })

    expect(errors.some(message => message.includes('should not exist'))).toBe(true)
  })
})
