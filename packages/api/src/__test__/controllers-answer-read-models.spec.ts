import { globSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findEntityReturns } from './entityReturns.js'

const SRC_ROOT = join(import.meta.dirname, '..')
const TSCONFIG = join(SRC_ROOT, '..', 'tsconfig.json')

const FIXTURE_CONTROLLER = join(SRC_ROOT, 'widgets', 'widgets.controller.ts')
const FIXTURE_CONTROLLER_SOURCE = `
import { Controller, Get, Post } from '@nestjs/common'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Widget {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  apikey: string
}

export class SpecialWidget extends Widget {}

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

  @Get('by-id')
  async byId(): Promise<{ [id: string]: Widget }> {
    return {}
  }

  @Get('special')
  async special(): Promise<SpecialWidget> {
    return new SpecialWidget()
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
 * Handlers that still answer an entity. An entry leaves in the PR that reshapes its
 * endpoint into a read model; none may be added.
 */
const KNOWN_EXCEPTIONS: string[] = [
  'DeviceModelsController.createPalette',
  'PluginsController.applyRecipeUpdate',
  'PluginsController.clearWebhookPayload',
  'PluginsController.create',
  'PluginsController.importFromGithub',
  'PluginsController.importFromRecipe',
  'PluginsController.importPlugin',
  'PluginsController.regenerateWebhookToken',
  'ScheduleController.create',
  'ScheduleController.get',
  'ScheduleController.update',
]

describe('admin controllers answer read models, never entities (ADR-0033)', () => {
  it('flags a handler whose return type carries an entity, declared or inferred', () => {
    const found = findEntityReturns([FIXTURE_CONTROLLER], TSCONFIG, { [FIXTURE_CONTROLLER]: FIXTURE_CONTROLLER_SOURCE })

    expect(found).toEqual([
      { handler: 'WidgetsController.list', entities: ['Widget'] },
      { handler: 'WidgetsController.undeclared', entities: ['Widget'] },
      { handler: 'WidgetsController.nullable', entities: ['Widget'] },
      { handler: 'WidgetsController.byId', entities: ['Widget'] },
      { handler: 'WidgetsController.special', entities: ['Widget'] },
    ])
  }, 60_000)

  it('finds no entity-returning handler beyond the known exceptions, and no exception that is already fixed', () => {
    const controllers = globSync('**/*.controller.ts', { cwd: SRC_ROOT }).map(file => join(SRC_ROOT, file))

    const found = findEntityReturns(controllers, TSCONFIG).map(({ handler }) => handler)

    expect(found.sort()).toEqual([...KNOWN_EXCEPTIONS].sort())
  }, 60_000)
})
