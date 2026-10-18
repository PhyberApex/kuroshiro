import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { ServerUnreachable } from '../client'
import { callSetup, pollDisplay } from '../deviceCalls'

const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error)

describe('the Device-facing calls', () => {
  it('answers the body of a 2xx', async () => {
    api.use(http.get(apiUrl('setup'), () => HttpResponse.json({ status: 200, friendly_id: 'A1B2C3' })))

    expect(await callSetup({ ID: 'AA:BB:CC:DD:EE:FF' })).toEqual({ answered: { status: 200, friendly_id: 'A1B2C3' } })
  })

  it('takes a request that never reached the server for an unreachable server', async () => {
    api.use(http.get(apiUrl('setup'), () => HttpResponse.error()))

    expect(await failureOf(callSetup({ ID: 'AA:BB:CC:DD:EE:FF' }))).toBeInstanceOf(ServerUnreachable)
  })

  it('takes a 2xx whose body is not JSON for something in the server\'s place', async () => {
    api.use(http.get(apiUrl('display'), () => HttpResponse.text('<html>Bad gateway</html>')))

    expect(await failureOf(pollDisplay({ 'ID': 'AA:BB:CC:DD:EE:FF', 'Access-Token': 'secret' }))).toBeInstanceOf(ServerUnreachable)
  })

  it('words a refusal whose message is a list by joining it with semicolons', async () => {
    api.use(http.get(apiUrl('display'), () => HttpResponse.json(
      { statusCode: 400, error: 'Bad Request', message: ['Battery-Voltage must be a number', 'RSSI must be a number'] },
      { status: 400 },
    )))

    expect(await pollDisplay({ 'ID': 'AA:BB:CC:DD:EE:FF', 'Access-Token': 'secret' }))
      .toEqual({ refused: '400 Bad Request: Battery-Voltage must be a number; RSSI must be a number.' })
  })
})
