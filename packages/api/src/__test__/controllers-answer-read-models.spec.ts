import { globSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findEntityReturns } from './entityReturns.js'

const SRC_ROOT = join(import.meta.dirname, '..')
const TSCONFIG = join(SRC_ROOT, '..', 'tsconfig.json')

const WRONG_CONTROLLER = join(SRC_ROOT, 'widgets', 'widgets.controller.ts')
const WRONG_CONTROLLER_SOURCE = `
import { Controller, Get, Post } from '@nestjs/common'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Widget {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  apikey: string
}

interface WidgetRead {
  id: string
  createdAt: string | null
}

@Controller('widgets')
export class WidgetsController {
  @Get()
  async list(): Promise<Widget[]> {
    return []
  }

  @Get('undeclared')
  async undeclared() {
    return { widget: new Widget() }
  }

  @Get('nullable')
  async nullable(): Promise<Widget | null> {
    return null
  }

  @Post()
  async create(): Promise<WidgetRead> {
    return { id: '1', createdAt: null }
  }

  helper(): Widget {
    return new Widget()
  }
}
`

/**
 * Handlers that still answer an entity. Each entry leaves with the slice of the admin UI
 * rebuild (#1074) that reshapes its endpoint into a read model; none may be added.
 */
const KNOWN_EXCEPTIONS: string[] = [
  'DeviceModelsController.createPalette',
  'DeviceModelsController.getAll',
  'DeviceModelsController.getPalettes',
  'DevicesController.add',
  'DevicesController.getAll',
  'FirmwareController.getAll',
  'FirmwareController.upload',
  'LogsController.getLogsByDevice',
  'MashupController.create',
  'MashupController.getConfiguration',
  'MashupController.update',
  'PluginsController.applyRecipeUpdate',
  'PluginsController.assignToDevice',
  'PluginsController.clearWebhookPayload',
  'PluginsController.create',
  'PluginsController.duplicate',
  'PluginsController.findAll',
  'PluginsController.findByDevice',
  'PluginsController.findById',
  'PluginsController.importFromGithub',
  'PluginsController.importFromRecipe',
  'PluginsController.importPlugin',
  'PluginsController.regenerateWebhookToken',
  'PluginsController.update',
  'PluginsController.updateDeviceAssignment',
  'ScheduleController.create',
  'ScheduleController.get',
  'ScheduleController.update',
  'ScreensController.add',
  'ScreensController.getAll',
  'ScreensController.getByDevice',
  'ScreensController.reorder',
]

describe('admin controllers answer read models, never entities (ADR-0033)', () => {
  it('flags a handler whose return type carries an entity, declared or inferred', () => {
    const found = findEntityReturns([WRONG_CONTROLLER], TSCONFIG, { [WRONG_CONTROLLER]: WRONG_CONTROLLER_SOURCE })

    expect(found).toEqual([
      { handler: 'WidgetsController.list', entities: ['Widget'] },
      { handler: 'WidgetsController.undeclared', entities: ['Widget'] },
      { handler: 'WidgetsController.nullable', entities: ['Widget'] },
    ])
  }, 60_000)

  it('finds no entity-returning handler beyond the known exceptions, and no exception that is already fixed', () => {
    const controllers = globSync('**/*.controller.ts', { cwd: SRC_ROOT }).map(file => join(SRC_ROOT, file))

    const found = findEntityReturns(controllers, TSCONFIG).map(({ handler }) => handler)

    expect(found.sort()).toEqual([...KNOWN_EXCEPTIONS].sort())
  }, 60_000)
})
