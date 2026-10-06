import type { RecipeUpdateMode, RecipeUpdatePreview } from 'kuroshiro-shared'
import type { ApplyRecipeUpdateDto } from '../dto/apply-recipe-update.dto.js'
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
  UpdateItem,
} from './recipe-update-diff.js'
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { ApiException } from '../../errors/api.exception.js'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { PluginTemplate } from '../entities/plugin-template.entity.js'
import { Plugin as PluginEntity } from '../entities/plugin.entity.js'
import { pluginNotFound, PluginsService } from '../plugins.service.js'
import { toRecipeUpdatePreview } from '../recipe-update.mapper.js'
import { PluginFieldValuesService } from './plugin-field-values.service.js'
import { PluginImporterService } from './plugin-importer.service.js'
import { computeRecipeContentHash, diffRecipeUpdate } from './recipe-update-diff.js'

const PLUGIN_UPDATE_RELATIONS = { dataSources: true, templates: true, fields: true } as const

interface BasicFieldUpdates {
  name?: string
  description?: string | null
  refreshInterval?: number
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
      headers: dataSource.headers ?? undefined,
      body: dataSource.body ?? undefined,
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
      options: field.options,
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
    private readonly fieldValues: PluginFieldValuesService,
  ) {}

  async checkForUpdate(pluginId: string): Promise<RecipeUpdatePreview> {
    const { plugin, upstream, contentHash, mode, items } = await this.prepareDiff(pluginId)

    return toRecipeUpdatePreview({
      recipe: { id: plugin.sourceRecipeId!, name: upstream.name },
      snapshotTakenAt: plugin.sourceRecipeSnapshot ? plugin.snapshotTakenAt ?? null : null,
      contentHash,
      mode,
      items,
      requiredFieldsLeftEmpty: await this.requiredFieldsLeftEmpty(pluginId, items),
    })
  }

  /** Writes what is chosen and takes the Recipe as it is now as the Recipe Snapshot; `apply: []` writes only the Recipe Snapshot. */
  async applyUpdate(pluginId: string, dto: ApplyRecipeUpdateDto): Promise<void> {
    const { plugin, upstream, contentHash, items } = await this.prepareDiff(pluginId)

    if (contentHash !== dto.contentHash) {
      throw new ApiException(HttpStatus.CONFLICT, 'recipe-changed', 'The Recipe changed since the check ran; run the check again.')
    }

    const selected = this.resolveSelectedItems(items, dto.apply)
    const basicFieldUpdates = await this.applySelectedItems(plugin, selected)

    await this.pluginRepository.update(pluginId, {
      ...basicFieldUpdates,
      sourceRecipeSnapshot: { ...upstream },
      snapshotTakenAt: new Date(),
    })

    if (selected.length > 0) {
      await this.pluginsService.refreshRendersAfterSave(pluginId)
    }
  }

  private async prepareDiff(pluginId: string): Promise<{ plugin: Plugin, upstream: ParsedPlugin, contentHash: string, mode: RecipeUpdateMode, items: UpdateItem[] }> {
    const plugin = await this.loadPluginWithSourceRecipe(pluginId)
    const upstream = await this.importerService.importFromRecipe(plugin.sourceRecipeId!)
    const contentHash = computeRecipeContentHash(upstream)
    const { mode, items } = diffRecipeUpdate(this.snapshotOf(plugin), toComparablePlugin(plugin), parsedToComparable(upstream))
    return { plugin, upstream, contentHash, mode, items }
  }

  private itemKey(itemType: string, key: string): string {
    return `${itemType}:${key}`
  }

  private resolveSelectedItems(items: UpdateItem[], apply: ApplyRecipeUpdateDto['apply']): UpdateItem[] {
    const itemIndex = new Map(items.map(item => [this.itemKey(item.itemType, item.key), item]))

    return apply.map((selection) => {
      const item = itemIndex.get(this.itemKey(selection.itemType, selection.key))
      if (!item) {
        throw new BadRequestException(`No pending Recipe update for ${selection.itemType} "${selection.key}"`)
      }
      return item
    })
  }

  private async applySelectedItems(plugin: Plugin, selected: UpdateItem[]): Promise<BasicFieldUpdates> {
    const basicFieldUpdates: BasicFieldUpdates = {}

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
          break
        case 'dataSource':
          await this.applyDataSourceItem(plugin, item)
          break
        case 'template':
          await this.applyTemplateItem(plugin, item)
          break
        case 'field':
          await this.applyFieldItem(plugin, item)
          break
      }
    }

    return basicFieldUpdates
  }

  private snapshotOf(plugin: Plugin): ComparablePlugin | null {
    return plugin.sourceRecipeSnapshot ? parsedToComparable(plugin.sourceRecipeSnapshot as unknown as ParsedPlugin) : null
  }

  private async loadPluginWithSourceRecipe(pluginId: string): Promise<Plugin> {
    const plugin = isUUID(pluginId) ? await this.pluginRepository.findOne({ where: { id: pluginId }, relations: PLUGIN_UPDATE_RELATIONS }) : null
    if (!plugin)
      throw pluginNotFound(pluginId)
    if (!plugin.sourceRecipeId)
      throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-from-recipe', `Plugin ${pluginId} was not imported from a Recipe.`)
    return plugin
  }

  // Field Values belong to the Plugin (ADR-0032), so whether one is stored is asked of the Plugin alone.
  private async requiredFieldsLeftEmpty(pluginId: string, items: UpdateItem[]): Promise<string[]> {
    const stored = await this.fieldValues.storedFor(pluginId)
    return items
      .filter(item => item.itemType === 'field' && item.kind !== 'removed')
      .map(item => item.upstream as NormalizedField)
      .filter(field => field.required && !field.defaultValue && !stored[field.keyname])
      .map(field => field.keyname)
  }

  private async applyDataSourceItem(plugin: Plugin, item: UpdateItem): Promise<void> {
    const existing = plugin.dataSources.find(dataSource => dataSource.name === item.key)

    if (item.kind === 'removed') {
      await this.removeDataSource(plugin, existing)
      return
    }

    const fields = this.buildDataSourceFields(item.upstream as NormalizedDataSource, existing?.headers ?? undefined)

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

  // Matched by keyname: a kept Plugin Field keeps its id and so its Field
  // Value, and a removed one takes its Field Value with it through
  // PluginFieldValue's `onDelete: 'CASCADE'` FK to PluginField (ADR-0032).
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
      options: upstream.options,
      required: upstream.required,
      order: upstream.order,
    }

    if (existing) {
      const previousFieldType = existing.fieldType
      Object.assign(existing, fields)
      await this.fieldRepository.save(existing)
      await this.fieldValues.clearFieldsRetypedFromPassword([{ previousFieldType, field: existing }])
    }
    else {
      const created = this.fieldRepository.create({ ...fields, keyname: item.key, plugin })
      plugin.fields.push(await this.fieldRepository.save(created))
    }
  }
}
