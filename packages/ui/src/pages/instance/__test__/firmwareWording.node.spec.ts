import { describe, expect, it } from 'vitest'
import { buildDeviceModel } from '@/testing/fixtures/device-models'
import { buildFirmware } from '@/testing/fixtures/firmware'
import { autoUpdateNote, checkedNote, deletionWording, earlierNote, headedFor, newestOfficialVersion, syncOutcome, whatItIs } from '../firmwareWording'

const MODELS = [
  buildDeviceModel({ name: 'og_png', label: 'TRMNL OG (1-bit)' }),
  buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG' }),
  buildDeviceModel({ name: 'v2', label: 'TRMNL X' }),
]

const KITCHEN = { id: 'kitchen', name: 'Kitchen' }
const HALLWAY = { id: 'hallway', name: 'Hallway' }
const STUDY = { id: 'study', name: 'Study' }

describe('firmware wording', () => {
  describe('what a Firmware is', () => {
    it('is official and fits the Device Models it names, by their labels', () => {
      expect(whatItIs(buildFirmware({ compatibleModels: ['og_png', 'og_plus'] }), MODELS)).toBe('Official · Fits TRMNL OG (1-bit) and TRMNL OG')
    })

    it('is custom with its label, and fits every Device Model when it names none', () => {
      expect(whatItIs(buildFirmware({ kind: 'custom', label: 'TRMNL X build' }), MODELS)).toBe('Custom · TRMNL X build · Fits every Device Model')
    })

    it('names a Device Model this Instance does not know as the Firmware names it', () => {
      expect(whatItIs(buildFirmware({ kind: 'custom', label: null, compatibleModels: ['v2', 'inkplate_10'] }), MODELS)).toBe('Custom · Fits TRMNL X and inkplate_10')
    })
  })

  describe('where a Firmware is headed', () => {
    it('goes out only to the Devices with a push of it pending', () => {
      const firmware = buildFirmware({ targetOf: [{ ...HALLWAY, pushPending: true }, { ...STUDY, pushPending: false }] })

      expect(headedFor(firmware)).toEqual({ goesOutTo: [HALLWAY], runningOn: [] })
    })

    it('runs on the Devices that report its version', () => {
      expect(headedFor(buildFirmware({ runningOn: [KITCHEN, STUDY] }))).toEqual({ goesOutTo: [], runningOn: [KITCHEN, STUDY] })
    })
  })

  describe('the newest official Firmware', () => {
    it('is the first official one that is not deprecated', () => {
      expect(newestOfficialVersion([
        buildFirmware({ kind: 'custom', version: '2.0.3' }),
        buildFirmware({ version: '1.7.9' }),
        buildFirmware({ version: '1.6.9', deprecated: true }),
      ])).toBe('1.7.9')
      expect(newestOfficialVersion([buildFirmware({ kind: 'custom', version: '2.0.3' })])).toBeUndefined()
    })
  })

  describe('firmware Auto-Update', () => {
    it('says what updates a Device while it is off', () => {
      expect(autoUpdateNote(false, '1.7.9')).toBe('A Device only updates when you press “Update now” in its Settings. While on, each new official Firmware is pushed to every Device it fits.')
    })

    it('names the newest version no Device is caught up to while it is on', () => {
      expect(autoUpdateNote(true, '1.7.9')).toBe('Each new official Firmware becomes the target of every Device it fits, except a mirrored Device and one with a push already pending. It starts with the next official Firmware; Devices are not caught up to 1.7.9 now.')
    })

    it('leaves the catching up out where there is no official Firmware yet', () => {
      expect(autoUpdateNote(true, undefined)).toBe('Each new official Firmware becomes the target of every Device it fits, except a mirrored Device and one with a push already pending. It starts with the next official Firmware.')
    })
  })

  describe('when TRMNL was last checked', () => {
    it('says TRMNL was checked where the last sync worked', () => {
      expect(checkedNote({ ranAt: '2026-10-03T04:00:00.000Z', ok: true, error: null })).toBe('Checked TRMNL')
    })

    it('says the last check failed where it did not work', () => {
      expect(checkedNote({ ranAt: '2026-10-03T04:00:00.000Z', ok: false, error: 'TRMNL did not answer' })).toBe('Last check of TRMNL failed')
    })

    it('says nothing where TRMNL was never asked', () => {
      expect(checkedNote(null)).toBeUndefined()
    })
  })

  describe('a sync from TRMNL', () => {
    const synced = { ranAt: '2026-10-03T07:35:00.000Z', inserted: true, version: '1.8.0', assigned: [] }

    it('found nothing new', () => {
      expect(syncOutcome({ ...synced, inserted: false, version: '1.7.9' }, false)).toBe('Nothing new. 1.7.9 is still TRMNL\'s newest official Firmware.')
    })

    it('found a new one that no Device is given while Firmware Auto-Update is off', () => {
      expect(syncOutcome(synced, false)).toBe('Synced 1.8.0. No Device is given it until you choose it as that Device\'s target.')
    })

    it('found a new one that Firmware Auto-Update gave to Devices', () => {
      expect(syncOutcome({ ...synced, assigned: [KITCHEN, STUDY] }, true)).toBe('Synced 1.8.0. Firmware Auto-Update made it the target of Kitchen and Study; it goes out at their next poll.')
      expect(syncOutcome({ ...synced, assigned: [KITCHEN] }, true)).toBe('Synced 1.8.0. Firmware Auto-Update made it the target of Kitchen; it goes out at its next poll.')
    })

    it('found a new one that no Device is free to take', () => {
      expect(syncOutcome(synced, true)).toBe('Synced 1.8.0. No Device it fits is free to take it.')
    })
  })

  describe('earlier official Firmware', () => {
    it('names what replaced it', () => {
      expect(earlierNote('1.7.9')).toBe('Replaced by 1.7.9 and no longer offered as a target. A Device that already targets one keeps it.')
      expect(earlierNote(undefined)).toBe('No longer offered as a target. A Device that already targets one keeps it.')
    })
  })

  describe('deleting a custom Firmware', () => {
    const custom = buildFirmware({ kind: 'custom', version: '1.8.0-rc2', label: 'Release candidate, battery fix' })

    it('loses the Firmware and its file and leaves every Device alone when none targets it', () => {
      expect(deletionWording(custom)).toEqual({
        title: 'Delete Firmware 1.8.0-rc2?',
        happens: undefined,
        lost: 'Firmware 1.8.0-rc2 (Release candidate, battery fix) and its file.',
        stays: 'Every Device goes on running the Firmware it has. No Device has this one as its target.',
      })
    })

    it('names the Device whose pending push is cancelled', () => {
      expect(deletionWording({ ...custom, targetOf: [{ ...STUDY, pushPending: true }] })).toEqual({
        title: 'Delete Firmware 1.8.0-rc2?',
        happens: 'Study has it as its target Firmware, with a push pending. Deleting cancels that push.',
        lost: 'Firmware 1.8.0-rc2 (Release candidate, battery fix) and its file. The pending push to Study.',
        stays: 'Study goes on running the Firmware it has, with no target.',
      })
    })

    it('leaves a Device that targets it without a pending push with no target, and cancels nothing', () => {
      expect(deletionWording({ ...custom, targetOf: [{ ...STUDY, pushPending: false }, { ...HALLWAY, pushPending: true }] })).toEqual({
        title: 'Delete Firmware 1.8.0-rc2?',
        happens: 'Hallway has it as its target Firmware, with a push pending. Deleting cancels that push.',
        lost: 'Firmware 1.8.0-rc2 (Release candidate, battery fix) and its file. The pending push to Hallway.',
        stays: 'Study and Hallway go on running the Firmware they have, with no target.',
      })
    })

    it('speaks of several pending pushes in the plural', () => {
      const wording = deletionWording({ ...custom, targetOf: [{ ...STUDY, pushPending: true }, { ...HALLWAY, pushPending: true }] })

      expect(wording.happens).toBe('Study and Hallway have it as their target Firmware, with a push pending. Deleting cancels those pushes.')
      expect(wording.lost).toBe('Firmware 1.8.0-rc2 (Release candidate, battery fix) and its file. The pending pushes to Study and Hallway.')
    })

    it('loses no file where the file is already missing, and names a Firmware without a label by its version alone', () => {
      expect(deletionWording({ ...custom, label: null, filePresent: false }).lost).toBe('Firmware 1.8.0-rc2.')
    })
  })
})
