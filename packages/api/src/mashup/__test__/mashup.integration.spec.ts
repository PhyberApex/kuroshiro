import type { TestingModule } from '@nestjs/testing'
import type { Repository } from 'typeorm'
import type { PluginTemplate } from '../../plugins/entities/plugin-template.entity'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Device } from '../../devices/devices.entity'
import { DeviceDisplayService } from '../../devices/display.service'
import { Plugin } from '../../plugins/entities/plugin.entity'
import { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import { Screen } from '../../screens/screens.entity'
import { MashupConfiguration } from '../entities/mashup-configuration.entity'
import { MashupSlot } from '../entities/mashup-slot.entity'
import { MashupService } from '../mashup.service'
import { MashupRendererService } from '../services/mashup-renderer.service'

describe('mashup Integration Tests', () => {
  let mashupService: MashupService
  let deviceRepo: Repository<Device>
  let screenRepo: Repository<Screen>
  let pluginRepo: Repository<Plugin>
  let mashupConfigRepo: Repository<MashupConfiguration>
  let mashupSlotRepo: Repository<MashupSlot>

  beforeEach(async () => {
    const mockDevice = {
      id: 'device-1',
      name: 'Test Device',
      width: 800,
      height: 480,
    }

    const mockPlugins = [
      {
        id: 'plugin-1',
        name: 'Weather Plugin',
        template: {
          html: '<div class="plugin-weather">{{weather}}</div>',
        } as PluginTemplate,
      },
      {
        id: 'plugin-2',
        name: 'Calendar Plugin',
        template: {
          html: '<div class="plugin-calendar">{{events}}</div>',
        } as PluginTemplate,
      },
    ]

    deviceRepo = {
      findOne: vi.fn().mockResolvedValue(mockDevice),
    } as any

    pluginRepo = {
      findOne: vi.fn((opts) => {
        const id = opts.where.id
        return Promise.resolve(mockPlugins.find(p => p.id === id) || null)
      }),
      find: vi.fn().mockResolvedValue(mockPlugins),
    } as any

    screenRepo = {
      create: vi.fn((data) => {
        return { ...data, id: 'screen-1', isActive: false }
      }),
      save: vi.fn((screen) => {
        return Promise.resolve(screen)
      }),
      update: vi.fn().mockResolvedValue(undefined),
      findOne: vi.fn((opts) => {
        if (opts.where.id === 'screen-1') {
          return Promise.resolve({
            id: 'screen-1',
            type: 'mashup',
            filename: 'Test Mashup',
            device: mockDevice,
            mashupConfiguration: {
              id: 'config-1',
              layout: '1Lx1R',
              slots: [
                {
                  id: 'slot-1',
                  position: 'L',
                  size: '50',
                  order: 0,
                  plugin: mockPlugins[0],
                },
                {
                  id: 'slot-2',
                  position: 'R',
                  size: '50',
                  order: 1,
                  plugin: mockPlugins[1],
                },
              ],
            },
          })
        }
        return Promise.resolve(null)
      }),
    } as any

    mashupConfigRepo = {
      create: vi.fn((data) => {
        return { ...data, id: 'config-1' }
      }),
      save: vi.fn((config) => {
        return Promise.resolve(config)
      }),
      findOne: vi.fn().mockResolvedValue(null),
    } as any

    mashupSlotRepo = {
      create: vi.fn((data) => {
        return { ...data, id: `slot-${Math.random()}` }
      }),
      save: vi.fn((slot) => {
        return Promise.resolve(slot)
      }),
      find: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
    } as any

    const mockPluginRenderer = {
      render: vi.fn((plugin) => {
        if (plugin.id === 'plugin-1') {
          return Promise.resolve('<div class="plugin-weather">Sunny 72°F</div>')
        }
        if (plugin.id === 'plugin-2') {
          return Promise.resolve('<div class="plugin-calendar">Meeting at 2pm</div>')
        }
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
        MashupRendererService,
        DeviceDisplayService,
        {
          provide: getRepositoryToken(Device),
          useValue: deviceRepo,
        },
        {
          provide: getRepositoryToken(Screen),
          useValue: screenRepo,
        },
        {
          provide: getRepositoryToken(Plugin),
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
      render: vi.fn((plugin) => {
        if (plugin.id === 'plugin-1') {
          return Promise.resolve('<div class="plugin-weather">Sunny 72°F</div>')
        }
        if (plugin.id === 'plugin-2') {
          return Promise.resolve('<div class="plugin-calendar">Meeting at 2pm</div>')
        }
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

    const mockMashupConfig = {
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        {
          id: 'slot-1',
          position: 'L',
          size: '50',
          order: 0,
          plugin: {
            id: 'plugin-1',
            name: 'Weather Plugin',
            dataSource: { type: 'static', config: {} },
            templates: [{ html: '<div>test</div>' }],
          } as Plugin,
        },
        {
          id: 'slot-2',
          position: 'R',
          size: '50',
          order: 1,
          plugin: {
            id: 'plugin-2',
            name: 'Calendar Plugin',
            dataSource: { type: 'static', config: {} },
            templates: [{ html: '<div>test</div>' }],
          } as Plugin,
        },
      ],
    } as MashupConfiguration

    const mockDevice = {
      id: 'device-1',
      name: 'Test Device',
      width: 800,
      height: 480,
    } as Device

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
      render: vi.fn((plugin) => {
        if (plugin.id === 'plugin-1') {
          return Promise.reject(new Error('Plugin render failed'))
        }
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

    const mockMashupConfig = {
      id: 'config-1',
      layout: '1Lx1R',
      slots: [
        {
          id: 'slot-1',
          position: 'L',
          size: '50',
          order: 0,
          plugin: {
            id: 'plugin-1',
            name: 'Weather Plugin',
          } as Plugin,
        },
        {
          id: 'slot-2',
          position: 'R',
          size: '50',
          order: 1,
          plugin: {
            id: 'plugin-2',
            name: 'Calendar Plugin',
          } as Plugin,
        },
      ],
    } as MashupConfiguration

    const mockDevice = {
      id: 'device-1',
      width: 800,
      height: 480,
    } as Device

    const html = await renderer.renderMashup(mockMashupConfig, mockDevice)

    expect(html).toContain('error.png')
    expect(html).toContain('Weather Plugin')
    expect(html).toContain('class="plugin-calendar"')
  })

  it('should update an existing mashup and clear old slots', async () => {
    const existingScreen = {
      id: 'screen-1',
      type: 'mashup' as const,
      filename: 'Old Mashup',
      device: { id: 'device-1' },
      mashupConfiguration: {
        id: 'config-1',
        slots: [
          { id: 'old-slot-1', plugin: { id: 'plugin-1' } },
          { id: 'old-slot-2', plugin: { id: 'plugin-2' } },
        ],
      },
    }

    screenRepo.findOne = vi.fn().mockResolvedValue(existingScreen)
    mashupConfigRepo.findOne = vi.fn().mockResolvedValue(existingScreen.mashupConfiguration)

    const dto = {
      filename: 'Updated Mashup',
      layout: '1Lx1R',
      pluginIds: ['plugin-2', 'plugin-1'],
    }

    const result = await mashupService.update('screen-1', dto)

    expect(result).toBeDefined()
    expect(result.filename).toBe('Updated Mashup')
    expect(mashupSlotRepo.remove).toHaveBeenCalledWith(existingScreen.mashupConfiguration.slots)
    expect(mashupSlotRepo.save).toHaveBeenCalled()
  })

  it('should delete mashup and cascade to configuration and slots', async () => {
    const existingScreen = {
      id: 'screen-1',
      type: 'mashup' as const,
      device: { id: 'device-1' },
      mashupConfiguration: {
        id: 'config-1',
      },
    }

    screenRepo.findOne = vi.fn().mockResolvedValue(existingScreen)
    screenRepo.remove = vi.fn().mockResolvedValue(undefined)

    await mashupService.delete('screen-1')

    expect(screenRepo.remove).toHaveBeenCalledWith(existingScreen)
  })
})
