import type { TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import { Screen } from '../../screens/screens.entity.js'
import { makeMashupConfiguration, makeMashupSlot, makePlugin, makeScreen } from '../../test/fixtures.js'
import { createMockRepository } from '../../test/mockRepository.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin } from '../entities/plugin.entity.js'
import { PluginsService } from '../plugins.service.js'
import { PluginDataFetcherService } from '../services/plugin-data-fetcher.service.js'
import { PluginRendererService } from '../services/plugin-renderer.service.js'
import { PluginSchedulerService } from '../services/plugin-scheduler.service.js'
import { PluginTransformService } from '../services/plugin-transform.service.js'

describe('plugin Deletion with Mashup Warning Integration', () => {
  let pluginsService: PluginsService
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>> & { manager: { getRepository: (entity: string) => unknown } }
  let devicePluginRepo: ReturnType<typeof createMockRepository<DevicePlugin>>
  let mashupSlotRepo: ReturnType<typeof createMockRepository<MashupSlot>>

  beforeEach(async () => {
    const mockPlugin = makePlugin({ id: 'plugin-1', name: 'Weather Plugin' })

    const mockScheduler = {
      removeScheduledJob: vi.fn(),
    }

    mashupSlotRepo = createMockRepository<MashupSlot>()

    pluginRepo = {
      ...createMockRepository<Plugin>(),
      manager: {
        getRepository: (entity: string) => entity === 'MashupSlot' ? mashupSlotRepo : null,
      },
    }
    pluginRepo.findOne.mockResolvedValue(mockPlugin)
    pluginRepo.findOneBy.mockResolvedValue(mockPlugin)
    pluginRepo.remove.mockResolvedValue(mockPlugin)

    devicePluginRepo = createMockRepository<DevicePlugin>()
    devicePluginRepo.find.mockResolvedValue([])

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
    mashupSlotRepo.find.mockResolvedValue([
      makeMashupSlot({
        id: 'slot-1',
        mashupConfiguration: makeMashupConfiguration({
          screen: makeScreen({ id: 'screen-1', filename: 'Dashboard' }),
        }),
      }),
    ])

    await expect(pluginsService.remove('plugin-1', false)).rejects.toThrow(BadRequestException)
  })

  it.skip('should allow deletion with force flag even when used in mashups', async () => {
    mashupSlotRepo.find.mockResolvedValue([
      makeMashupSlot({
        id: 'slot-1',
        mashupConfiguration: makeMashupConfiguration({
          screen: makeScreen({ id: 'screen-1', filename: 'Dashboard' }),
        }),
      }),
    ])

    const result = await pluginsService.remove('plugin-1', true)

    expect(result).toBe(true)
    expect(pluginRepo.remove).toHaveBeenCalled()
  })

  it('should return mashup usage information when checking plugin', async () => {
    mashupSlotRepo.find.mockResolvedValue([
      makeMashupSlot({
        id: 'slot-1',
        mashupConfiguration: makeMashupConfiguration({
          screen: makeScreen({ id: 'screen-1', filename: 'Dashboard' }),
        }),
      }),
      makeMashupSlot({
        id: 'slot-2',
        mashupConfiguration: makeMashupConfiguration({
          screen: makeScreen({ id: 'screen-2', filename: 'Weather Screen' }),
        }),
      }),
    ])

    const usage = await pluginsService.checkPluginUsage('plugin-1')

    expect(usage.inMashups).toHaveLength(2)
    expect(usage.inMashups[0].screenId).toBe('screen-1')
    expect(usage.inMashups[0].screenName).toBe('Dashboard')
    expect(usage.inMashups[1].screenId).toBe('screen-2')
    expect(usage.inMashups[1].screenName).toBe('Weather Screen')
  })

  it.skip('should delete plugin when not used in any mashups', async () => {
    mashupSlotRepo.find.mockResolvedValue([])

    const result = await pluginsService.remove('plugin-1', false)

    expect(result).toBe(true)
    expect(pluginRepo.remove).toHaveBeenCalled()
  })
})
