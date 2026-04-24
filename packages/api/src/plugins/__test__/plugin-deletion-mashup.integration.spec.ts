import type { TestingModule } from '@nestjs/testing'
import type { Repository } from 'typeorm'
import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity'
import { Screen } from '../../screens/screens.entity'
import { DevicePlugin } from '../entities/device-plugin.entity'
import { PluginDataSource } from '../entities/plugin-data-source.entity'
import { PluginField } from '../entities/plugin-field.entity'
import { PluginTemplate } from '../entities/plugin-template.entity'
import { Plugin } from '../entities/plugin.entity'
import { PluginsService } from '../plugins.service'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service'
import { PluginRendererService } from '../services/plugin-renderer.service'
import { PluginSchedulerService } from '../services/plugin-scheduler.service'
import { PluginTransformService } from '../services/plugin-transform.service'

describe('plugin Deletion with Mashup Warning Integration', () => {
  let pluginsService: PluginsService
  let pluginRepo: Repository<Plugin>
  let devicePluginRepo: Repository<DevicePlugin>
  let mashupSlotRepo: Repository<MashupSlot>

  beforeEach(async () => {
    const mockPlugin = {
      id: 'plugin-1',
      name: 'Weather Plugin',
    }

    const mockScheduler = {
      removeScheduledJob: vi.fn(),
    }

    pluginRepo = {
      findOne: vi.fn().mockResolvedValue(mockPlugin),
      findOneBy: vi.fn().mockResolvedValue(mockPlugin),
      remove: vi.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: vi.fn((entity: string) => {
          if (entity === 'MashupSlot')
            return mashupSlotRepo
          return null
        }),
      },
    } as any

    devicePluginRepo = {
      find: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
    } as any

    mashupSlotRepo = {
      find: vi.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        {
          provide: getRepositoryToken(Plugin),
          useValue: pluginRepo,
        },
        {
          provide: getRepositoryToken(DevicePlugin),
          useValue: devicePluginRepo,
        },
        {
          provide: getRepositoryToken(Screen),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PluginDataSource),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PluginTemplate),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PluginField),
          useValue: {},
        },
        {
          provide: getRepositoryToken(MashupSlot),
          useValue: mashupSlotRepo,
        },
        {
          provide: PluginDataFetcherService,
          useValue: {},
        },
        {
          provide: PluginRendererService,
          useValue: {},
        },
        {
          provide: PluginSchedulerService,
          useValue: mockScheduler,
        },
        {
          provide: PluginTransformService,
          useValue: {},
        },
      ],
    }).compile()

    pluginsService = module.get<PluginsService>(PluginsService)

    // Wait for lazy injection of mashupSlotRepository
    await new Promise(resolve => setTimeout(resolve, 10))
  })

  it.skip('should throw error when deleting plugin used in mashups without force flag', async () => {
    mashupSlotRepo.find = vi.fn().mockResolvedValue([
      {
        id: 'slot-1',
        mashupConfiguration: {
          screen: {
            id: 'screen-1',
            filename: 'Dashboard',
          } as Screen,
        },
      },
    ])

    await expect(pluginsService.remove('plugin-1', false)).rejects.toThrow(BadRequestException)
  })

  it.skip('should allow deletion with force flag even when used in mashups', async () => {
    mashupSlotRepo.find = vi.fn().mockResolvedValue([
      {
        id: 'slot-1',
        mashupConfiguration: {
          screen: {
            id: 'screen-1',
            filename: 'Dashboard',
          } as Screen,
        },
      },
    ])

    const result = await pluginsService.remove('plugin-1', true)

    expect(result).toBe(true)
    expect(pluginRepo.remove).toHaveBeenCalled()
  })

  it('should return mashup usage information when checking plugin', async () => {
    mashupSlotRepo.find = vi.fn().mockResolvedValue([
      {
        id: 'slot-1',
        mashupConfiguration: {
          screen: {
            id: 'screen-1',
            filename: 'Dashboard',
          } as Screen,
        },
      },
      {
        id: 'slot-2',
        mashupConfiguration: {
          screen: {
            id: 'screen-2',
            filename: 'Weather Screen',
          } as Screen,
        },
      },
    ])

    const usage = await pluginsService.checkPluginUsage('plugin-1')

    expect(usage.inMashups).toHaveLength(2)
    expect(usage.inMashups[0].screenId).toBe('screen-1')
    expect(usage.inMashups[0].screenName).toBe('Dashboard')
    expect(usage.inMashups[1].screenId).toBe('screen-2')
    expect(usage.inMashups[1].screenName).toBe('Weather Screen')
  })

  it.skip('should delete plugin when not used in any mashups', async () => {
    mashupSlotRepo.find = vi.fn().mockResolvedValue([])

    const result = await pluginsService.remove('plugin-1', false)

    expect(result).toBe(true)
    expect(pluginRepo.remove).toHaveBeenCalled()
  })
})
