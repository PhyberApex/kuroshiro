import type { FirmwareDraft } from '../uploadFirmware'
import { describe, expect, it } from 'vitest'
import { ApiRefusal } from '@/api/client'
import { buildApiError } from '@/testing/fixtures/errors'
import { draftProblems, uploadInput, uploadRefusedAt } from '../uploadFirmware'

const FILE = new File([new Uint8Array(16)], 'trmnl-x.bin')

function draft(changes: Partial<FirmwareDraft> = {}): FirmwareDraft {
  return { file: FILE, version: '2.0.3', label: '', fits: 'some', models: ['v2'], ...changes }
}

describe('uploading a Firmware', () => {
  it('finds nothing wrong with a file, a version and a Device Model', () => {
    expect(draftProblems(draft())).toEqual({})
  })

  it('needs a file, a version and, for only some Device Models, at least one', () => {
    expect(draftProblems(draft({ file: null, version: '  ', models: [] }))).toEqual({
      file: 'Choose the Firmware file to upload.',
      version: 'A Firmware needs a version.',
      fits: 'Tick at least one Device Model, or choose “Every Device Model”.',
    })
  })

  it('needs no Device Model ticked for every Device Model', () => {
    expect(draftProblems(draft({ fits: 'all', models: [] }))).toEqual({})
  })

  it('sends the version and the label trimmed, and the Device Models that are ticked', () => {
    expect(uploadInput(draft({ version: ' 2.0.3 ', label: ' TRMNL X build ', models: ['v2', 'og_plus'] })))
      .toEqual({ version: '2.0.3', label: 'TRMNL X build', compatibleModels: ['v2', 'og_plus'] })
  })

  it('sends no label where none was entered, so the file\'s name is used', () => {
    expect(uploadInput(draft())).toEqual({ version: '2.0.3', compatibleModels: ['v2'] })
  })

  it('sends no Device Model for every Device Model, whatever was ticked before', () => {
    expect(uploadInput(draft({ fits: 'all', models: ['v2'] }))).toEqual({ version: '2.0.3', compatibleModels: [] })
  })

  describe('a refusal', () => {
    const refusal = (overrides: Parameters<typeof buildApiError>[0]) => new ApiRefusal(buildApiError(overrides))

    it('of a version that exists is worded on the version', () => {
      expect(uploadRefusedAt(refusal({ statusCode: 409, code: 'firmware-version-taken' }), '2.0.3'))
        .toEqual({ version: 'There is already a Firmware 2.0.3. Give this one a version that tells them apart.' })
    })

    it('of a Device Model the Instance does not know names it at "Fits"', () => {
      expect(uploadRefusedAt(refusal({ statusCode: 422, code: 'device-model-unknown', details: { names: ['v2', 'inkplate_10'] } }), '2.0.3'))
        .toEqual({ fits: 'This Instance does not know the Device Models v2 and inkplate_10. Untick them, or sync the Device Models from TRMNL.' })
      expect(uploadRefusedAt(refusal({ statusCode: 422, code: 'device-model-unknown', details: { names: ['v2'] } }), '2.0.3'))
        .toEqual({ fits: 'This Instance does not know the Device Model v2. Untick it, or sync the Device Models from TRMNL.' })
    })

    it('of a file that is too large is worded on the file', () => {
      expect(uploadRefusedAt(refusal({ statusCode: 413, code: 'upload-too-large', details: { limitBytes: 8 * 1024 * 1024 } }), '2.0.3'))
        .toEqual({ file: 'That file is larger than the 8 MB this Instance accepts.' })
    })

    it('of a field the server validates is worded on that field', () => {
      expect(uploadRefusedAt(refusal({ statusCode: 400, code: 'validation', fields: [{ path: 'version', message: 'version should not be empty' }] }), ''))
        .toEqual({ version: 'version should not be empty' })
    })

    it('of anything else belongs to no field', () => {
      expect(uploadRefusedAt(refusal({ statusCode: 500, code: 'internal' }), '2.0.3')).toEqual({})
      expect(uploadRefusedAt(new Error('Kuroshiro\'s server is not answering.'), '2.0.3')).toEqual({})
    })
  })
})
