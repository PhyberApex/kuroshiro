import { describe, expect, it } from 'vitest'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { palettesOf, startingChoice, targetOf } from '../previewTarget'

const kitchen = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })
const hallway = buildDeviceSummary({ id: 'hallway', name: 'Hallway', deviceModel: { name: 'seeed_e1002', label: 'Seeed E1002', width: 800, height: 480, deprecated: false } })
const study = buildDeviceSummary({ id: 'study', name: 'Study', deviceModel: null })

const bw = buildPalette({ id: 'bw', name: 'Black & White (1-bit)', grays: 2, frameworkClass: 'screen--1bit' })
const gray4 = buildPalette({ id: 'gray-4', name: '4 Grays (2-bit)', grays: 4, usedBy: [{ id: 'kitchen', name: 'Kitchen' }] })
const color6 = buildPalette({ id: 'color-6a', name: 'Color (6 colors)', grays: 2, colors: ['#000', '#fff', '#f00', '#0f0', '#00f', '#ff0'], frameworkClass: 'screen--color-6a', usedBy: [{ id: 'hallway', name: 'Hallway' }] })

const og = buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG (2-bit)', paletteIds: ['bw', 'gray-4'] })
const seeed = buildDeviceModel({ name: 'seeed_e1002', label: 'Seeed E1002', paletteIds: ['bw', 'color-6a'] })
const x = buildDeviceModel({ name: 'v2', label: 'TRMNL X', width: 1872, height: 1404, paletteIds: ['gray-4', 'bw'] })

const library = { devices: [kitchen, hallway, study], models: [x, og, seeed], palettes: [bw, gray4, color6] }

const assignedTo = (...deviceIds: string[]) => buildPluginDetail().assignments.slice(0, 1).flatMap(assignment => deviceIds.map(deviceId => ({ ...assignment, deviceId })))

describe('what the preview is for', () => {
  describe('at the start', () => {
    it('is the first Device the Plugin is assigned to', () => {
      expect(startingChoice(assignedTo('hallway', 'kitchen'), library.devices)).toEqual({ deviceId: 'hallway', modelName: null, paletteId: null })
    })

    it('is the first Device there is for a Plugin on no Device, or on one that is gone', () => {
      expect(startingChoice([], library.devices).deviceId).toBe('kitchen')
      expect(startingChoice(assignedTo('attic'), library.devices).deviceId).toBe('kitchen')
    })

    it('is no Device where there is none', () => {
      expect(startingChoice(assignedTo('attic'), [])).toEqual({ deviceId: null, modelName: null, paletteId: null })
    })
  })

  describe('the target of a choice', () => {
    it('is a Device with its own Device Model and the Palette it is set to', () => {
      expect(targetOf({ deviceId: 'hallway', modelName: null, paletteId: null }, library)).toEqual({ device: hallway, model: seeed, palette: color6 })
    })

    it('is TRMNL OG and its richest Palette for a Device whose Device Model and Palette are not known', () => {
      expect(targetOf({ deviceId: 'study', modelName: null, paletteId: null }, library)).toEqual({ device: study, model: og, palette: gray4 })
    })

    it('starts at TRMNL OG and 4 Grays with no Device', () => {
      expect(targetOf({ deviceId: null, modelName: null, paletteId: null }, library)).toEqual({ device: null, model: og, palette: gray4 })
    })

    it('is the chosen Device Model and Palette', () => {
      expect(targetOf({ deviceId: null, modelName: 'seeed_e1002', paletteId: 'bw' }, library)).toEqual({ device: null, model: seeed, palette: bw })
    })

    it('starts a chosen Device Model at its richest Palette, also when the Palette chosen before is not one of its own', () => {
      expect(targetOf({ deviceId: null, modelName: 'seeed_e1002', paletteId: null }, library)?.palette).toBe(color6)
      expect(targetOf({ deviceId: null, modelName: 'v2', paletteId: 'color-6a' }, library)?.palette).toBe(gray4)
    })

    it('is the first Device Model where this Instance does not hold TRMNL OG', () => {
      expect(targetOf({ deviceId: null, modelName: null, paletteId: null }, { ...library, models: [x, seeed] })?.model).toBe(x)
    })

    it('is nothing while this Instance holds no Device Model, or none of its Palettes', () => {
      expect(targetOf({ deviceId: null, modelName: null, paletteId: null }, { ...library, models: [] })).toBeUndefined()
      expect(targetOf({ deviceId: null, modelName: null, paletteId: null }, { ...library, palettes: [] })).toBeUndefined()
    })
  })

  it('lists a Device Model\'s Palettes in the Device Model\'s own order', () => {
    expect(palettesOf(x, library.palettes)).toEqual([gray4, bw])
  })
})
