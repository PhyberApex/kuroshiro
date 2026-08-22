import type { TestingModule } from '@nestjs/testing'
import type { PluginTemplate } from '../../plugins/entities/plugin-template.entity'
import type { Plugin } from '../../plugins/entities/plugin.entity'
import type { Screen } from '../../screens/screens.entity'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Device } from '../../devices/devices.entity'
import { Plugin as PluginEntity } from '../../plugins/entities/plugin.entity'
import { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import { Screen as ScreenEntity } from '../../screens/screens.entity'
import { makeDevice, makeMashupConfiguration, makeMashupSlot, makePlugin, makePluginTemplate, makeScreen } from '../../test/fixtures'
import { createMockRepository, whereId } from '../../test/mockRepository'
import { MashupConfiguration } from '../entities/mashup-configuration.entity'
import { MashupSlot } from '../entities/mashup-slot.entity'
import { MashupService } from '../mashup.service'
import { MashupRendererService } from '../services/mashup-renderer.service'

describe('mashup Integration Tests', () => {
  let mashupService: MashupService
  let deviceRepo: ReturnType<typeof createMockRepository<Device>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>
  let pluginRepo: ReturnType<typeof createMockRepository<Plugin>>
  let mashupConfigRepo: ReturnType<typeof createMockRepository<MashupConfiguration>>
  let mashupSlotRepo: ReturnType<typeof createMockRepository<MashupSlot>>

  beforeEach(async () => {
    const mockDevice = makeDevice({ id: 'device-1', name: 'Test Device', width: 800, height: 480 })

    const mockPlugins: Array<Plugin & { template: PluginTemplate }> = [
      {
        ...makePlugin({ id: 'plugin-1', name: 'Weather Plugin' }),
        template: makePluginTemplate({ liquidMarkup: '<div class="plugin-weather">{{weather}}</div>' }),
      },
      {
        ...makePlugin({ id: 'plugin-2', name: 'Calendar Plugin' }),
        template: makePluginTemplate({ liquidMarkup: '<div class="plugin-calendar">{{events}}</div>' }),
      },
    ]

    deviceRepo = createMockRepository<Device>()
    deviceRepo.findOne.mockResolvedValue(mockDevice)

    pluginRepo = createMockRepository<Plugin>()
    pluginRepo.findOne.mockImplementation(async options =>
      mockPlugins.find(p => p.id === whereId(options)) ?? null)
    pluginRepo.find.mockResolvedValue(mockPlugins)

    screenRepo = createMockRepository<Screen>()
    screenRepo.create.mockImplementation(data => makeScreen({ ...(data as Partial<Screen>), id: 'screen-1', isActive: false }))
    screenRepo.save.mockImplementation(async screen => screen)
    screenRepo.update.mockResolvedValue({ raw: [], generatedMaps: [] })
    screenRepo.findOne.mockImplementation(async (options) => {
      if (whereId(options) === 'screen-1') {
        return makeScreen({
          id: 'screen-1',
          type: 'mashup',
          filename: 'Test Mashup',
          device: mockDevice,
          mashupConfiguration: makeMashupConfiguration({
            id: 'config-1',
            layout: '1Lx1R',
            slots: [
              makeMashupSlot({ id: 'slot-1', position: 'L', size: '50', order: 0, plugin: mockPlugins[0] }),
              makeMashupSlot({ id: 'slot-2', position: 'R', size: '50', order: 1, plugin: mockPlugins[1] }),
            ],
          }),
        })
      }
      return null
    })

    mashupConfigRepo = createMockRepository<MashupConfiguration>()
    mashupConfigRepo.create.mockImplementation(data => makeMashupConfiguration({ ...(data as Partial<MashupConfiguration>), id: 'config-1' }))
    mashupConfigRepo.save.mockImplementation(async config => config)
    mashupConfigRepo.findOne.mockResolvedValue(null)

    mashupSlotRepo = createMockRepository<MashupSlot>()
    mashupSlotRepo.create.mockImplementation(data => makeMashupSlot({ ...(data as Partial<MashupSlot>), id: `slot-${Math.random()}` }))
    mashupSlotRepo.save.mockImplementation(async slot => slot)
    mashupSlotRepo.find.mockResolvedValue([])
    mashupSlotRepo.remove.mockResolvedValue([])

    const mockPluginRenderer = {
      render: vi.fn((plugin: Plugin) => {
        if (plugin.id === 'plugin-1')
          return Promise.resolve('<div class="plugin-weather">Sunny 72°F</div>')

        if (plugin.id === 'plugin-2')
          return Promise.resolve('<div class="plugin-calendar">Meeting at 2pm</div>')

        return Promise.resolve('<div>Unknown</div>')
      }),
    }

    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'api_url')
          return 'http://localhost:3000'
        return null
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MashupService,
        {
          provide: getRepositoryToken(Device),
          useValue: deviceRepo,
        },
        {
          provide: getRepositoryToken(ScreenEntity),
          useValue: screenRepo,
        },
        {
          provide: getRepositoryToken(PluginEntity),
          useValue: pluginRepo,
        },
        {
          provide: getRepositoryToken(MashupConfiguration),
          useValue: mashupConfigRepo,
        },
        {
          provide: getRepositoryToken(MashupSlot),
          useValue: mashupSlotRepo,
        },
        {
          provide: PluginRendererService,
          useValue: mockPluginRenderer,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    mashupService = module.get<MashupService>(MashupService)
  })

  it('should create a mashup with two plugins in 1Lx1R layout', async () => {
    const dto = {
      deviceId: 'device-1',
      filename: 'Test Mashup',
      layout: '1Lx1R',
      pluginIds: ['plugin-1', 'plugin-2'],
    }

    const result = await mashupService.create(dto)

    expect(result).toBeDefined()
    expect(result.type).toBe('mashup')
    expect(result.filename).toBe('Test Mashup')
    expect(screenRepo.create).toHaveBeenCalled()
    expect(screenRepo.save).toHaveBeenCalled()
    expect(mashupConfigRepo.create).toHaveBeenCalled()
    expect(mashupConfigRepo.save).toHaveBeenCalled()
  })

  it.skip('should render mashup HTML with plugin content', async () => {
    const mockPluginRenderer = {
      render: vi.fn((plugin: Plugin) => {
        if (plugin.id === 'plugin-1')
          return Promise.resolve('<div class="plugin-weather">Sunny 72°F</div>')

        if (plugin.id === 'plugin-2')
          return Promise.resolve('<div class="plugin-calendar">Meeting at 2pm</div>')

        return Promise.resolve('<div>Unknown</div>')
      }),
    }

    const module = await Test.createTestingModule({
      providers: [
        MashupRendererService,
        {
          provide: PluginRendererService,
          useValue: mockPluginRenderer,
        },
        {
          provide: PluginDataFetcherService,
          useValue: {},
        },
        {
          provide: PluginTransformService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'api_url')
                return 'http://localhost:3000'
              return null
            }),
          },
        },
      ],
    }).compile()

    const renderer = module.get<MashupRendererService>(MashupRendererService)

    const mockMashupConfig = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        makeMashupSlot({
          id: 'slot-1',
          position: 'L',
          size: '50',
          order: 0,
          plugin: makePlugin({
            id: 'plugin-1',
            name: 'Weather Plugin',
            templates: [makePluginTemplate({ liquidMarkup: '<div>test</div>' })],
          }),
        }),
        makeMashupSlot({
          id: 'slot-2',
          position: 'R',
          size: '50',
          order: 1,
          plugin: makePlugin({
            id: 'plugin-2',
            name: 'Calendar Plugin',
            templates: [makePluginTemplate({ liquidMarkup: '<div>test</div>' })],
          }),
        }),
      ],
    })

    const mockDevice = makeDevice({ id: 'device-1', name: 'Test Device', width: 800, height: 480 })

    const html = await renderer.renderMashup(mockMashupConfig, mockDevice)

    expect(html).toContain('class="screen"')
    expect(html).toContain('class="mashup mashup--1Lx1R"')
    expect(html).toContain('class="plugin-weather"')
    expect(html).toContain('class="plugin-calendar"')
    expect(html).toContain('Sunny 72°F')
    expect(html).toContain('Meeting at 2pm')
  })

  it.skip('should handle plugin rendering errors gracefully in mashup', async () => {
    const mockPluginRenderer = {
      render: vi.fn((plugin: Plugin) => {
        if (plugin.id === 'plugin-1')
          return Promise.reject(new Error('Plugin render failed'))

        return Promise.resolve('<div class="plugin-calendar">Meeting at 2pm</div>')
      }),
    }

    const module = await Test.createTestingModule({
      providers: [
        MashupRendererService,
        {
          provide: PluginRendererService,
          useValue: mockPluginRenderer,
        },
        {
          provide: PluginDataFetcherService,
          useValue: {},
        },
        {
          provide: PluginTransformService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'api_url')
                return 'http://localhost:3000'
              return null
            }),
          },
        },
      ],
    }).compile()

    const renderer = module.get<MashupRendererService>(MashupRendererService)

    const mockMashupConfig = makeMashupConfiguration({
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        makeMashupSlot({ id: 'slot-1', position: 'L', size: '50', order: 0, plugin: makePlugin({ id: 'plugin-1', name: 'Weather Plugin' }) }),
        makeMashupSlot({ id: 'slot-2', position: 'R', size: '50', order: 1, plugin: makePlugin({ id: 'plugin-2', name: 'Calendar Plugin' }) }),
      ],
    })

    const mockDevice = makeDevice({ id: 'device-1', width: 800, height: 480 })

    const html = await renderer.renderMashup(mockMashupConfig, mockDevice)

    expect(html).toContain('error.png')
    expect(html).toContain('Weather Plugin')
    expect(html).toContain('class="plugin-calendar"')
  })

  it('should update an existing mashup and clear old slots', async () => {
    const existingScreen = makeScreen({
      id: 'screen-1',
      type: 'mashup',
      filename: 'Old Mashup',
      device: makeDevice({ id: 'device-1' }),
      mashupConfiguration: makeMashupConfiguration({
        id: 'config-1',
        slots: [
          makeMashupSlot({ id: 'old-slot-1', plugin: makePlugin({ id: 'plugin-1' }) }),
          makeMashupSlot({ id: 'old-slot-2', plugin: makePlugin({ id: 'plugin-2' }) }),
        ],
      }),
    })

    screenRepo.findOne.mockResolvedValue(existingScreen)
    mashupConfigRepo.findOne.mockResolvedValue(existingScreen.mashupConfiguration ?? null)

    const dto = {
      filename: 'Updated Mashup',
      layout: '1Lx1R',
      pluginIds: ['plugin-2', 'plugin-1'],
    }

    const result = await mashupService.update('screen-1', dto)

    expect(result).toBeDefined()
    expect(result.filename).toBe('Updated Mashup')
    expect(mashupSlotRepo.remove).toHaveBeenCalledWith(existingScreen.mashupConfiguration?.slots)
    expect(mashupSlotRepo.save).toHaveBeenCalled()
  })

  it('should delete mashup and cascade to configuration and slots', async () => {
    const existingScreen = makeScreen({
      id: 'screen-1',
      type: 'mashup',
      device: makeDevice({ id: 'device-1' }),
      mashupConfiguration: makeMashupConfiguration({ id: 'config-1' }),
    })

    screenRepo.findOne.mockResolvedValue(existingScreen)
    screenRepo.remove.mockResolvedValue([])

    await mashupService.delete('screen-1')

    expect(screenRepo.remove).toHaveBeenCalledWith(existingScreen)
  })
})
