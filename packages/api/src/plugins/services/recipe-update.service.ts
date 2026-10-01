import type { ApplyRecipeUpdateDto } from '../dto/apply-recipe-update.dto.js'
import type { DevicePlugin } from '../entities/device-plugin.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { ParsedPlugin } from './plugin-importer.service.js'
import type {
  ComparableDataSource,
  ComparableField,
  ComparablePlugin,
  ComparableTemplate,
  NormalizedDataSource,
  NormalizedField,
  NormalizedTemplate,
  RecipeUpdateMode,
  UpdateItem,
} from './recipe-update-diff.js'
import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin as PluginEntity } from '../entities/plugin.entity.js'
import { PluginsService } from '../plugins.service.js'
import { PluginImporterService } from './plugin-importer.service.js'
import { computeRecipeContentHash, diffRecipeUpdate } from './recipe-update-diff.js'

const PLUGIN_UPDATE_RELATIONS = { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } } as const

interface BasicFieldUpdates {
  name?: string
  description?: string | null
  refreshInterval?: number
}

export interface AssignmentsMissingRequiredField {
  key: string
  assignments: Array<{ deviceId: string, deviceName: string }>
}

export interface RecipeUpdatePreview {
  contentHash: string
  mode: RecipeUpdateMode
  items: UpdateItem[]
  assignmentsMissingRequiredField: AssignmentsMissingRequiredField[]
}

function toComparablePlugin(plugin: Plugin): ComparablePlugin {
  return {
    name: plugin.name,
    description: plugin.description,
    refreshInterval: plugin.refreshInterval,
    dataSources: (plugin.dataSources ?? []).map((dataSource): ComparableDataSource => ({
      name: dataSource.name,
      mode: dataSource.mode,
      method: dataSource.method,
      url: dataSource.url,
      headers: dataSource.headers,
      body: dataSource.body,
      transformJs: dataSource.transformJs,
      literalValue: dataSource.literalValue,
    })),
    templates: (plugin.templates ?? []).map((template): ComparableTemplate => ({
      layout: template.layout,
      liquidMarkup: template.liquidMarkup,
    })),
    fields: (plugin.fields ?? []).map((field): ComparableField => ({
      keyname: field.keyname,
      fieldType: field.fieldType,
      name: field.name,
      description: field.description,
      defaultValue: field.defaultValue,
      required: field.required,
      order: field.order,
    })),
  }
}

// The stored Recipe Snapshot and a freshly re-fetched Recipe are both the
// importer's ParsedPlugin shape, so they map onto the same ComparablePlugin
// shape `toComparablePlugin` builds from a live Plugin entity.
function parsedToComparable(parsed: ParsedPlugin): ComparablePlugin {
  return {
    name: parsed.name,
    description: parsed.description,
    refreshInterval: parsed.refreshInterval,
    dataSources: parsed.dataSources,
    templates: parsed.templates,
    fields: parsed.fields,
  }
}

@Injectable()
export class RecipeUpdateService {
  constructor(
    @InjectRepository(PluginEntity)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
    @InjectRepository(PluginTemplate)
    private readonly templateRepository: Repository<PluginTemplate>,
    @InjectRepository(PluginField)
    private readonly fieldRepository: Repository<PluginField>,
    private readonly importerService: PluginImporterService,
    private readonly pluginsService: PluginsService,
  ) {}

  async checkForUpdate(pluginId: string): Promise<RecipeUpdatePreview> {
    const plugin = await this.loadPluginWithSourceRecipe(pluginId)
    const upstream = await this.fetchUpstream(plugin.sourceRecipeId!)
    const contentHash = computeRecipeContentHash(upstream)

    const { mode, items } = diffRecipeUpdate(
      this.snapshotOf(plugin),
      toComparablePlugin(plugin),
      parsedToComparable(upstream),
    )

    return {
      contentHash,
      mode,
      items,
      assignmentsMissingRequiredField: this.missingRequiredFieldAssignments(items, plugin.deviceAssignments ?? []),
    }
  }

  async applyUpdate(pluginId: string, dto: ApplyRecipeUpdateDto): Promise<Plugin> {
    const plugin = await this.loadPluginWithSourceRecipe(pluginId)
    const upstream = await this.fetchUpstream(plugin.sourceRecipeId!)
    const contentHash = computeRecipeContentHash(upstream)

    if (contentHash !== dto.contentHash) {
      throw new ConflictException('The Recipe changed since the check ran; run the check again.')
    }

    const selected = this.resolveSelectedItems(plugin, upstream, dto.apply)
    const { basicFieldUpdates, reschedule } = await this.applySelectedItems(plugin, selected)

    await this.pluginRepository.update(pluginId, {
      ...basicFieldUpdates,
      sourceRecipeSnapshot: { ...upstream },
    })

    if (selected.length > 0) {
      await this.pluginsService.invalidateRenderCaches(pluginId)
      if (reschedule) {
        await this.pluginsService.rescheduleAfterUpdate(pluginId)
      }
    }

    return this.reload(pluginId)
  }

  private resolveSelectedItems(plugin: Plugin, upstream: ParsedPlugin, apply: ApplyRecipeUpdateDto['apply']): UpdateItem[] {
    const { items } = diffRecipeUpdate(this.snapshotOf(plugin), toComparablePlugin(plugin), parsedToComparable(upstream))
    const itemIndex = new Map(items.map(item => [`${item.itemType}:${item.key}`, item]))

    return apply.map((selection) => {
      const item = itemIndex.get(`${selection.itemType}:${selection.key}`)
      if (!item) {
        throw new BadRequestException(`No pending Recipe update for ${selection.itemType} "${selection.key}"`)
      }
      return item
    })
  }

  private async applySelectedItems(plugin: Plugin, selected: UpdateItem[]): Promise<{ basicFieldUpdates: BasicFieldUpdates, reschedule: boolean }> {
    const basicFieldUpdates: BasicFieldUpdates = {}
    let reschedule = false

    for (const item of selected) {
      switch (item.itemType) {
        case 'name':
          basicFieldUpdates.name = item.upstream as string
          break
        case 'description':
          basicFieldUpdates.description = (item.upstream as string | undefined) ?? null
          break
        case 'refreshInterval':
          basicFieldUpdates.refreshInterval = item.upstream as number
          reschedule = true
          break
        case 'dataSource':
          await this.applyDataSourceItem(plugin, item)
          reschedule = true
          break
        case 'template':
          await this.applyTemplateItem(plugin, item)
          reschedule = true
          break
        case 'field':
          await this.applyFieldItem(plugin, item)
          break
      }
    }

    return { basicFieldUpdates, reschedule }
  }

  private async reload(pluginId: string): Promise<Plugin> {
    const updated = await this.pluginRepository.findOne({ where: { id: pluginId }, relations: PLUGIN_UPDATE_RELATIONS })
    if (!updated) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }
    return updated
  }

  private snapshotOf(plugin: Plugin): ComparablePlugin | null {
    return plugin.sourceRecipeSnapshot ? parsedToComparable(plugin.sourceRecipeSnapshot as unknown as ParsedPlugin) : null
  }

  private async loadPluginWithSourceRecipe(pluginId: string): Promise<Plugin> {
    const plugin = await this.pluginRepository.findOne({ where: { id: pluginId }, relations: PLUGIN_UPDATE_RELATIONS })
    if (!plugin || !plugin.sourceRecipeId) {
      throw new NotFoundException(`Plugin ${pluginId} was not imported from a Recipe`)
    }
    return plugin
  }

  // Importer errors are plain `Error`s describing the recipe content/strategy
  // (OAuth, unsupported strategy, malformed archive) or the download itself
  // failing (recipe deleted, network issue) — the former are the caller's to
  // fix (400), the latter is the upstream Recipe being unreachable (502).
  private async fetchUpstream(recipeId: string): Promise<ParsedPlugin> {
    try {
      return await this.importerService.importFromRecipe(recipeId)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch the Recipe'
      if (message.startsWith('Failed to download Recipe archive')) {
        throw new BadGatewayException(message)
      }
      throw new BadRequestException(message)
    }
  }

  private missingRequiredFieldAssignments(items: UpdateItem[], assignments: DevicePlugin[]): AssignmentsMissingRequiredField[] {
    return items
      .filter(item => item.itemType === 'field' && item.kind === 'added' && (item.upstream as NormalizedField).required)
      .map(item => ({
        key: item.key,
        assignments: assignments.map(assignment => ({ deviceId: assignment.device.id, deviceName: assignment.device.name })),
      }))
  }

  private async applyDataSourceItem(plugin: Plugin, item: UpdateItem): Promise<void> {
    const existing = plugin.dataSources.find(dataSource => dataSource.name === item.key)

    if (item.kind === 'removed') {
      await this.removeDataSource(plugin, existing)
      return
    }

    const fields = this.buildDataSourceFields(item.upstream as NormalizedDataSource, existing?.headers)

    if (existing) {
      Object.assign(existing, fields)
      await this.dataSourceRepository.save(existing)
      return
    }

    const order = plugin.dataSources.reduce((max, dataSource) => Math.max(max, dataSource.order), -1) + 1
    const created = this.dataSourceRepository.create({ ...fields, name: item.key, order, plugin })
    plugin.dataSources.push(await this.dataSourceRepository.save(created))
  }

  private async removeDataSource(plugin: Plugin, existing: PluginDataSource | undefined): Promise<void> {
    if (!existing)
      return
    await this.dataSourceRepository.remove(existing)
    plugin.dataSources = plugin.dataSources.filter(dataSource => dataSource.id !== existing.id)
  }

  // Whole-item replace, except headers: an upstream header change must not
  // silently wipe a local-only header entry, since headers are where admins
  // put credentials (ADR-0030).
  private buildDataSourceFields(upstream: NormalizedDataSource, existingHeaders: Record<string, string> | undefined) {
    if (upstream.mode === 'literal') {
      return { mode: upstream.mode, literalValue: upstream.literalValue ?? null }
    }
    return {
      mode: upstream.mode,
      method: upstream.method ?? 'GET',
      url: upstream.url ?? undefined,
      body: upstream.body ?? {},
      transformJs: upstream.transformJs ?? null,
      headers: this.mergeHeaders(existingHeaders, upstream.headers),
    }
  }

  private mergeHeaders(localHeaders: Record<string, string> | undefined, upstreamHeaders: Record<string, string> | undefined): Record<string, string> {
    const upstream = upstreamHeaders ?? {}
    const localOnly = Object.fromEntries(Object.entries(localHeaders ?? {}).filter(([key]) => !(key in upstream)))
    return { ...localOnly, ...upstream }
  }

  private async applyTemplateItem(plugin: Plugin, item: UpdateItem): Promise<void> {
    const existing = plugin.templates.find(template => template.layout === item.key)

    if (item.kind === 'removed') {
      if (existing) {
        await this.templateRepository.remove(existing)
        plugin.templates = plugin.templates.filter(template => template.id !== existing.id)
      }
      return
    }

    const upstream = item.upstream as NormalizedTemplate

    if (existing) {
      existing.liquidMarkup = upstream.liquidMarkup
      await this.templateRepository.save(existing)
    }
    else {
      const created = this.templateRepository.create({ layout: item.key, liquidMarkup: upstream.liquidMarkup, plugin })
      plugin.templates.push(await this.templateRepository.save(created))
    }
  }

  // A removed field's stored values (one per Plugin Assignment) cascade-delete
  // at the DB level via PluginFieldValue's `onDelete: 'CASCADE'` FK to PluginField.
  private async applyFieldItem(plugin: Plugin, item: UpdateItem): Promise<void> {
    const existing = plugin.fields.find(field => field.keyname === item.key)

    if (item.kind === 'removed') {
      if (existing) {
        await this.fieldRepository.remove(existing)
        plugin.fields = plugin.fields.filter(field => field.id !== existing.id)
      }
      return
    }

    const upstream = item.upstream as NormalizedField
    const fields = {
      fieldType: upstream.fieldType,
      name: upstream.name,
      description: upstream.description,
      defaultValue: upstream.defaultValue,
      required: upstream.required,
      order: upstream.order,
    }

    if (existing) {
      Object.assign(existing, fields)
      await this.fieldRepository.save(existing)
    }
    else {
      const created = this.fieldRepository.create({ ...fields, keyname: item.key, plugin })
      plugin.fields.push(await this.fieldRepository.save(created))
    }
  }
}
