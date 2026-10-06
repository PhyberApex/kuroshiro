import type { ImportWarning } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { ApiRefusal, ServerUnreachable } from '@/api/client'
import { exactTime } from '@/patterns/time'
import { buildImportCheck, buildImportSummary } from '@/testing/fixtures/configuration'
import { addsLine, archiveLine, importedSentence, madeFor, overwritesLine, refusalNotice, replacesLine, wordWarning } from '../configurationArchiveWording'

const HALLWAY = { id: 'hallway', name: 'Hallway' }
const WEATHER = { id: 'weather', name: 'Weather' }

describe('configuration archive wording', () => {
  describe('what an import is made for', () => {
    it('says a fresh Instance is what it is made for', () => {
      expect(madeFor(0)).toBe('Made for a fresh Instance, like this one. Kuroshiro reads the archive first and changes nothing until you confirm.')
    })

    it('counts the Devices of one that is not fresh', () => {
      expect(madeFor(3)).toBe('Made for a fresh Instance. This one already has 3 Devices, so read what an import would change before you confirm it. Kuroshiro reads the archive first and changes nothing until you confirm.')
      expect(madeFor(1)).toContain('already has 1 Device,')
    })
  })

  describe('the archive', () => {
    const exported = exactTime(new Date('2026-09-28T19:14:00.000Z'))

    it('names the version it comes from and when it was exported', () => {
      expect(archiveLine(buildImportCheck().archive)).toBe(`A Configuration Archive from Kuroshiro 0.17.1, exported ${exported}.`)
    })

    it('says when it is a Redacted Archive', () => {
      expect(archiveLine({ ...buildImportCheck().archive, redacted: true })).toBe(`A Redacted Archive from Kuroshiro 0.17.1, exported ${exported}.`)
    })

    it('leaves out what a manifest does not say', () => {
      expect(archiveLine({ kuroshiroVersion: null, exportedAt: null, schemaVersion: 3, redacted: false })).toBe('A Configuration Archive.')
      expect(archiveLine({ kuroshiroVersion: null, exportedAt: 'last week', schemaVersion: 3, redacted: false })).toBe('A Configuration Archive.')
    })
  })

  describe('what it adds', () => {
    it('counts by kind in the glossary\'s words, naming the Devices', () => {
      expect(addsLine(buildImportCheck())).toBe('1 Device (Hallway), 4 Plugins, 9 Screens with their Schedules, 1 Mashup, 1 custom Palette, 1 custom Firmware')
    })

    it('counts one of a kind as one, and more Devices by their names', () => {
      const check = buildImportCheck({
        adds: { devices: 2, plugins: 1, screens: 1, schedules: 1, mashupConfigurations: 2, palettes: 2, firmware: 2 },
        devices: { added: [HALLWAY, { id: 'study', name: 'Study' }], overwritten: [] },
      })

      expect(addsLine(check)).toBe('2 Devices (Hallway and Study), 1 Plugin, 1 Screen with its Schedule, 2 Mashups, 2 custom Palettes, 2 custom Firmware')
    })

    it('does not speak of Schedules when it adds none, nor of the rows under a Plugin', () => {
      expect(addsLine(buildImportCheck({ adds: { screens: 2, dataSources: 4, templates: 3, fields: 2, fieldValues: 1, assignments: 1, mashupSlots: 2 }, devices: { added: [], overwritten: [] } }))).toBe('2 Screens')
    })

    it('is "Nothing" when it adds nothing', () => {
      expect(addsLine(buildImportCheck({ adds: {}, devices: { added: [], overwritten: [] } }))).toBe('Nothing')
    })
  })

  describe('what it overwrites', () => {
    it('counts what is already here under the same id, and says what is lost', () => {
      expect(overwritesLine(buildImportCheck())).toBe('1 Device (Kitchen), 6 Plugins and 5 Screens that are already here under the same id. What you changed on them since the export is lost.')
    })

    it('speaks of one record as one', () => {
      expect(overwritesLine(buildImportCheck({ overwrites: { plugins: 1 }, devices: { added: [], overwritten: [] } }))).toBe('1 Plugin that is already here under the same id. What you changed on it since the export is lost.')
    })

    it('counts Screens without their Schedules, which the example of the spec does not name', () => {
      expect(overwritesLine(buildImportCheck({ overwrites: { screens: 5, schedules: 2 }, devices: { added: [], overwritten: [] } }))).toBe('5 Screens that are already here under the same id. What you changed on them since the export is lost.')
    })

    it('is nothing when it overwrites nothing', () => {
      expect(overwritesLine(buildImportCheck({ overwrites: {}, devices: { added: [], overwritten: [] } }))).toBeUndefined()
    })
  })

  describe('what it replaces', () => {
    it('counts the Instance Settings the archive holds', () => {
      expect(replacesLine(2)).toBe('The Instance Settings, with the 2 the archive holds. The others go back to their fallback.')
    })

    it('says when the archive holds none', () => {
      expect(replacesLine(0)).toBe('The Instance Settings. The archive holds none, so every one goes back to its fallback.')
    })
  })

  it('counts what an import added and overwrote, as the summary before it did', () => {
    expect(importedSentence(buildImportSummary())).toBe('Added 17 records and overwrote 12. The Instance Settings were replaced.')
    expect(importedSentence(buildImportSummary({ created: { plugins: 1, templates: 2 }, updated: {} }))).toBe('Added 1 record and overwrote 0. The Instance Settings were replaced.')
  })

  it('words every warning by its kind', () => {
    const warnings: ImportWarning[] = [
      { kind: 'device-apikey-redacted', device: HALLWAY },
      { kind: 'device-apikeys-kept' },
      { kind: 'webhook-token-redacted', plugin: { id: 'doorbell', name: 'Doorbell note' } },
      { kind: 'header-redacted', plugin: { id: 'trains', name: 'Train departures' }, dataSource: 'departures', header: 'Authorization' },
      { kind: 'mirror-apikey-redacted', device: HALLWAY },
      { kind: 'field-value-redacted', plugin: WEATHER, keyname: 'api_key', label: 'API key' },
      { kind: 'field-value-without-field', plugin: WEATHER, keyname: 'town' },
      { kind: 'previous-version-values-dropped', plugin: WEATHER },
      { kind: 'firmware-file-missing', firmware: { id: 'x-build', version: '2.0.3' } },
      { kind: 'device-model-unknown', device: HALLWAY, deviceModel: 'inky_impression_99' },
      { kind: 'palette-unknown', device: HALLWAY, paletteId: 'p' },
      { kind: 'firmware-unknown', device: HALLWAY, firmwareId: 'f' },
    ]

    expect(warnings.map(wordWarning)).toEqual([
      'Hallway\'s API key was redacted. Hallway gets a new one and has to be set up again.',
      'Existing Devices kept their current API keys.',
      'The Webhook Token of Doorbell note was redacted. It gets a new Webhook URL; whatever posts to it needs the new one.',
      'A header of Train departures · departures was redacted and is left out. Enter it on the Plugin\'s page.',
      'Hallway\'s mirror API key was redacted. Mirroring is off for Hallway until you enter it.',
      'Weather\'s Field Value “API key” was redacted and is empty.',
      'Weather has no Plugin Field “town”, so the Field Value the archive holds for it is left out.',
      'Weather\'s Plugin Variables and the Field Values of its Screens are left out: Field Values now belong to the Plugin. Enter them on the Plugin\'s page.',
      'Firmware 2.0.3 comes without its file. Upload it again before pushing it.',
      'Hallway names a Device Model this Instance does not know. It is resolved again at its next poll.',
      'Hallway names a Palette this Instance does not know and uses its Device Model\'s richest Palette.',
      'Hallway names a target Firmware this Instance does not know and has no target Firmware.',
    ])
  })

  describe('a refusal', () => {
    const refusal = (code: ApiRefusal['code'], details?: Record<string, unknown>, statusCode = 400) =>
      new ApiRefusal({ statusCode, code, message: 'The server\'s own words.', details })

    it('names both archive versions and the Kuroshiro to export it from', () => {
      expect(refusalNotice(refusal('archive-schema-version', { archive: 1, expected: 3 }), '0.18.0')).toEqual({
        title: 'This archive cannot be imported.',
        reason: 'It was made with archive version 1, and this Kuroshiro reads version 3. Export it again from an Instance running Kuroshiro 0.18.0.',
      })
    })

    it('says so when the archive names no version', () => {
      expect(refusalNotice(refusal('archive-schema-version', { archive: null, expected: 3 }), '0.18.0').reason)
        .toBe('It does not say its archive version, and this Kuroshiro reads version 3. Export it again from an Instance running Kuroshiro 0.18.0.')
    })

    it('says what is not a Configuration Archive, whether a zip or not', () => {
      const notAnArchive = { title: 'This is not a Configuration Archive.', reason: 'It has to be the .zip a Configuration Export made.' }

      expect(refusalNotice(refusal('archive-not-zip'), '0.18.0')).toEqual(notAnArchive)
      expect(refusalNotice(refusal('archive-not-configuration'), '0.18.0')).toEqual(notAnArchive)
    })

    it('gives the server\'s reason for a record the database refuses', () => {
      const details = { entity: 'Screen', id: 'photo', reason: 'insert or update on table "screen" violates foreign key constraint' }

      expect(refusalNotice(refusal('archive-record-refused', details, 422), '0.18.0')).toEqual({
        title: 'This archive cannot be imported.',
        reason: 'Screen photo: insert or update on table "screen" violates foreign key constraint. Nothing was changed.',
      })
      expect(refusalNotice(refusal('archive-record-refused', { entity: 'Instance Settings', id: null, reason: 'Out of range.' }, 422), '0.18.0').reason)
        .toBe('Instance Settings: Out of range. Nothing was changed.')
    })

    it('gives any other failure its own sentence', () => {
      expect(refusalNotice(refusal('upload-too-large', { limitBytes: 50 * 1024 * 1024 }, 413), '0.18.0')).toEqual({
        title: 'This archive could not be read.',
        reason: 'That file is larger than the 50 MB this Instance accepts.',
      })
      expect(refusalNotice(new ServerUnreachable(), '0.18.0')).toEqual({
        title: 'This archive could not be read.',
        reason: 'Kuroshiro\'s server is not answering.',
      })
    })
  })
})
