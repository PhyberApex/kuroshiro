import type { Response } from 'express'
import type { ConfigurationExportService } from '../services/configuration-export.service.js'
import type { ConfigurationImportService } from '../services/configuration-import.service.js'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { ConfigurationController } from '../configuration.controller.js'

describe('configurationController', () => {
  let controller: ConfigurationController
  let mockExportService: { exportToZip: ReturnType<typeof vi.fn> }
  let mockImportService: { importFromZip: ReturnType<typeof vi.fn>, checkZip: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockExportService = { exportToZip: vi.fn() }
    mockImportService = { importFromZip: vi.fn(), checkZip: vi.fn() }

    controller = new ConfigurationController(
      asService<ConfigurationExportService>(mockExportService),
      asService<ConfigurationImportService>(mockImportService),
    )
  })

  it('exportConfiguration streams a zip with the secrets-warning header by default', async () => {
    const zipBuffer = Buffer.from('zip-content')
    mockExportService.exportToZip.mockResolvedValue(zipBuffer)

    const res = asService<Response>({
      setHeader: vi.fn(),
      send: vi.fn(),
    })

    await controller.exportConfiguration(undefined, res)

    expect(mockExportService.exportToZip).toHaveBeenCalledWith({ redact: false })
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip')
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="kuroshiro-config-'))
    expect(res.setHeader).toHaveBeenCalledWith('X-Kuroshiro-Contains-Secrets', 'true')
    expect(res.send).toHaveBeenCalledWith(zipBuffer)
  })

  it('exportConfiguration passes redact through and omits the secrets-warning header when redact=true', async () => {
    const zipBuffer = Buffer.from('zip-content')
    mockExportService.exportToZip.mockResolvedValue(zipBuffer)

    const res = asService<Response>({
      setHeader: vi.fn(),
      send: vi.fn(),
    })

    await controller.exportConfiguration('true', res)

    expect(mockExportService.exportToZip).toHaveBeenCalledWith({ redact: true })
    expect(res.setHeader).not.toHaveBeenCalledWith('X-Kuroshiro-Contains-Secrets', 'true')
    expect(res.send).toHaveBeenCalledWith(zipBuffer)
  })

  it('importConfiguration imports the uploaded archive', async () => {
    const file = asService<Express.Multer.File>({ buffer: Buffer.from('zip-content') })
    const summary = { created: { Device: 1 }, updated: {}, warnings: [] }
    mockImportService.importFromZip.mockResolvedValue(summary)

    const result = await controller.importConfiguration(file)

    expect(mockImportService.importFromZip).toHaveBeenCalledWith(file.buffer)
    expect(result).toBe(summary)
  })

  it('checkConfigurationImport reads the uploaded archive without importing it', async () => {
    const file = asService<Express.Multer.File>({ buffer: Buffer.from('zip-content') })
    const check = { adds: { devices: 1 } }
    mockImportService.checkZip.mockResolvedValue(check)

    const result = await controller.checkConfigurationImport(file)

    expect(mockImportService.checkZip).toHaveBeenCalledWith(file.buffer)
    expect(mockImportService.importFromZip).not.toHaveBeenCalled()
    expect(result).toBe(check)
  })

  it('importConfiguration throws if no file uploaded', async () => {
    await expect(controller.importConfiguration(undefined)).rejects.toThrow('No file uploaded')
  })
})
