import type { ConfigurationImportSummary, DeviceSummary, ImportCheck, ImportWarning } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { expect } from 'vitest'
import { exportZipResponse } from '@/pages/plugins/__test__/pluginPageHarness'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildImportCheck, buildImportSummary } from '@/testing/fixtures/configuration'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'

const ARCHIVE_PATH = '/instance/archive'

/** What a Redacted Archive brought onto another Instance makes an import say. */
export const REDACTED_WARNINGS: ImportWarning[] = [
  { kind: 'device-apikey-redacted', device: { id: 'hallway', name: 'Hallway' } },
  { kind: 'webhook-token-redacted', plugin: { id: 'doorbell', name: 'Doorbell note' } },
  { kind: 'header-redacted', plugin: { id: 'trains', name: 'Train departures' }, dataSource: 'departures', header: 'Authorization' },
  { kind: 'firmware-file-missing', firmware: { id: 'x-build', version: '2.0.3' } },
]

export const REDACTED_WARNING_LINES = [
  'Hallway\'s API key was redacted. Hallway gets a new one and has to be set up again.',
  'The Webhook Token of Doorbell note was redacted. It gets a new Webhook URL; whatever posts to it needs the new one.',
  'A header of Train departures · departures was redacted and is left out. Enter it on the Plugin\'s page.',
  'Firmware 2.0.3 comes without its file. Upload it again before pushing it.',
]

export interface FakedArchive {
  /** The Devices of the Instance. An import that is taken makes them `devicesAfterImport`. */
  devices: DeviceSummary[]
  devicesAfterImport: DeviceSummary[]
  /** What reading an archive answers: what importing it would do, or a refusal. */
  checkAnswer: ImportCheck | Response
  /** What importing one answers: what it did, or a refusal. */
  importAnswer: ConfigurationImportSummary | Response
  /** While set, neither is answered until it resolves. */
  holding?: Promise<unknown>
  /** Every archive the server was sent, in order: what was asked of it and the file's name. */
  sent: { asked: 'check' | 'import', file: string | undefined }[]
  /** Every address the page fetched for an export, in order. */
  exports: string[]
}

interface Faked {
  devices?: DeviceSummary[]
  check?: ImportCheck | Response
  summary?: ConfigurationImportSummary | Response
  /** The largest archive the Instance takes. */
  archiveUploadBytes?: number
}

const KITCHEN = buildDeviceSummary()
const HALLWAY = buildDeviceSummary({ id: 'd1f0a8c2-5b7e-4f3a-9c1d-2e4f6a8b0c1d', name: 'Hallway' })

/** Fakes an Instance with one Device, Kitchen, and the two routes an import calls. */
export function fakeArchive({ devices = [KITCHEN], check = buildImportCheck(), summary = buildImportSummary(), archiveUploadBytes = 256 * 1024 * 1024 }: Faked = {}): FakedArchive {
  const faked: FakedArchive = { devices, devicesAfterImport: [HALLWAY, KITCHEN], checkAnswer: check, importAnswer: summary, sent: [], exports: [] }

  async function taken(request: Request, asked: 'check' | 'import') {
    const file = (await request.formData()).get('file')
    faked.sent.push({ asked, file: file instanceof File ? file.name : undefined })
    await faked.holding
    const answer = asked === 'check' ? faked.checkAnswer : faked.importAnswer
    if (answer instanceof Response)
      return answer
    if (asked === 'import')
      faked.devices = faked.devicesAfterImport
    return HttpResponse.json(answer, { status: asked === 'check' ? 200 : 201 })
  }

  fakeShellReads({ instance: buildInstanceFacts({ version: '0.18.0', limits: { ...buildInstanceFacts().limits, archiveUploadBytes } }) })
  api.use(
    http.get(apiUrl('devices'), () => HttpResponse.json(faked.devices)),
    http.post(apiUrl('config/import/check'), ({ request }) => taken(request, 'check')),
    http.post(apiUrl('config/import'), ({ request }) => taken(request, 'import')),
    http.get(apiUrl('config/export'), ({ request }) => {
      faked.exports.push(request.url)
      return exportZipResponse('kuroshiro-config-2026-10-10T00-00-00-000Z.zip')
    }),
  )
  return faked
}

export async function mountArchive(at = ARCHIVE_PATH) {
  const screen = await mountApp({ at })
  await expect.element(screen.getByRole('heading', { level: 2, name: 'Configuration Archive' })).toBeVisible()
  await expect.element(screen.getByLabelText('Choose file')).toBeInTheDocument()
  return screen
}

export const archiveFile = (name = 'kuroshiro-config-2026-09-28.zip', bytes = 2048) => new File([new Uint8Array(bytes)], name)
