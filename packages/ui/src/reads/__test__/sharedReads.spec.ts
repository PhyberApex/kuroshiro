import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { mount, mountPage } from '@/testing/mount'
import ScheduleNoteExample from './examples/ScheduleNoteExample.vue'

describe('the shared reads', () => {
  it('name the server\'s timezone from the Instance facts, which are asked for once however many read them', async () => {
    let asked = 0
    api.use(http.get(apiUrl('instance'), () => {
      asked += 1
      return HttpResponse.json(buildInstanceFacts({ timezone: 'Europe/Berlin', version: '0.17.1' }))
    }))
    const screen = await mountPage({ routes: [{ path: '/', component: ScheduleNoteExample }], at: '/' })

    await expect.element(screen.getByText('Hours and dates are in the server\'s timezone, Europe/Berlin.')).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.17.1')).toBeVisible()

    window.dispatchEvent(new Event('focus'))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(asked).toBe(1)
  })

  it('say how to get them when a component is mounted without them', async () => {
    await expect(mount(ScheduleNoteExample)).rejects.toThrow('The shared reads are not installed')
  })
})
