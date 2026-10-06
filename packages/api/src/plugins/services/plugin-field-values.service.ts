import type { Plugin } from '../entities/plugin.entity.js'
import type { FieldValueView, StoredFieldValues } from '../plugin-field-values.js'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, In, Repository } from 'typeorm'
import { ApiException } from '../../errors/api.exception.js'
import { PluginFieldValue } from '../entities/plugin-field-value.entity.js'
import { PluginField } from '../entities/plugin-field.entity.js'
import { fieldValueViews, isSecretField, needsValues, resolveFieldValues } from '../plugin-field-values.js'

export type FieldValueWrites = Record<string, string | null>

export type PluginWithFieldValues<T extends Plugin = Plugin> = T & {
  fieldValues: Record<string, FieldValueView>
  needsValues: boolean
}

@Injectable()
export class PluginFieldValuesService {
  constructor(
    @InjectRepository(PluginFieldValue)
    private readonly fieldValueRepository: Repository<PluginFieldValue>,
    @InjectRepository(PluginField)
    private readonly fieldRepository: Repository<PluginField>,
  ) {}

  /** The same service reading and writing inside the transaction `manager` runs. */
  within(manager: EntityManager): PluginFieldValuesService {
    return new PluginFieldValuesService(manager.getRepository(PluginFieldValue), manager.getRepository(PluginField))
  }

  /** Stored Field Values by keyname, for each given Plugin. Secrets included: for renders, duplicates and the archive, never for an admin read. */
  async storedByPlugin(pluginIds: string[]): Promise<Map<string, StoredFieldValues>> {
    const byPlugin = new Map<string, StoredFieldValues>(pluginIds.map(id => [id, {}]))
    if (pluginIds.length === 0)
      return byPlugin

    const rows = await this.fieldValueRepository.find({
      where: { plugin: { id: In(pluginIds) } },
      relations: { field: true, plugin: true },
    })
    for (const row of rows) {
      byPlugin.get(row.plugin.id)![row.field.keyname] = row.value
    }
    return byPlugin
  }

  async storedFor(pluginId: string): Promise<StoredFieldValues> {
    return (await this.storedByPlugin([pluginId])).get(pluginId)!
  }

  /** What a render of the Plugin sees. `unsaved` lays writes that have not been saved over the stored values, with the same clearing rule as `write`. */
  async resolveFor(pluginId: string, unsaved: FieldValueWrites = {}): Promise<Record<string, string>> {
    const [fields, stored] = await Promise.all([
      this.fieldRepository.find({ where: { plugin: { id: pluginId } } }),
      this.storedFor(pluginId),
    ])
    const withUnsaved = Object.fromEntries(
      Object.entries({ ...stored, ...unsaved }).filter((entry): entry is [string, string] => !!entry[1]),
    )
    return resolveFieldValues(fields, withUnsaved)
  }

  async attach<T extends Plugin>(plugins: T[]): Promise<PluginWithFieldValues<T>[]> {
    const storedByPlugin = await this.storedByPlugin(plugins.map(plugin => plugin.id))
    return plugins.map((plugin) => {
      const fields = plugin.fields ?? []
      const stored = storedByPlugin.get(plugin.id) ?? {}
      return { ...plugin, fieldValues: fieldValueViews(fields, stored), needsValues: needsValues(fields, stored) }
    })
  }

  assertWritable(fields: Array<{ keyname: string }> | undefined, writes: FieldValueWrites | undefined): void {
    const keynames = (fields ?? []).map(field => field.keyname)
    for (const [keyname, value] of Object.entries(writes ?? {})) {
      if (!keynames.includes(keyname)) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'bad-request', `Field Value "${keyname}" has no Plugin Field of that keyname`, { keyname })
      }
      if (value !== null && typeof value !== 'string') {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'bad-request', `Field Value "${keyname}" must be a string, or null to clear it`, { keyname })
      }
    }
  }

  /**
   * Writes the given Field Values and leaves every keyname not mentioned as it
   * is, which is what keeps a write-only secret when an update omits it. `null`
   * or an empty string clears a value, so the Plugin Field's default applies again.
   * Returns whether anything stored changed.
   */
  async write(plugin: Pick<Plugin, 'id' | 'fields'>, writes: FieldValueWrites | undefined): Promise<boolean> {
    const entries = Object.entries(writes ?? {})
    if (entries.length === 0)
      return false

    const stored = await this.storedFor(plugin.id)
    const changes = entries
      .map(([keyname, value]) => ({ field: plugin.fields?.find(candidate => candidate.keyname === keyname), value: value || undefined }))
      .filter((change): change is { field: PluginField, value: string | undefined } => !!change.field && change.value !== stored[change.field.keyname])

    for (const { field, value } of changes) {
      await this.store(plugin, field, value)
    }

    return changes.length > 0
  }

  /**
   * Drops the stored value of each Plugin Field a save or a Recipe Update apply
   * just retyped away from password: a password is never readable back
   * (ADR-0032), so a value left on the row would answer in plain text once the
   * field's type says it is no secret. A field whose type was already
   * non-password, or that is still password, is left untouched.
   */
  async clearFieldsRetypedFromPassword(changed: Array<{ previousFieldType: string, field: Pick<PluginField, 'id' | 'fieldType'> }>): Promise<void> {
    const retyped = changed.filter(({ previousFieldType, field }) => isSecretField({ fieldType: previousFieldType }) && !isSecretField(field))
    if (retyped.length === 0)
      return

    await this.fieldValueRepository.delete({ field: { id: In(retyped.map(({ field }) => field.id)) } })
  }

  private async store(plugin: Pick<Plugin, 'id'>, field: PluginField, value: string | undefined): Promise<void> {
    if (value === undefined) {
      await this.fieldValueRepository.delete({ field: { id: field.id } })
      return
    }

    const existing = await this.fieldValueRepository.findOne({ where: { field: { id: field.id } } })
    await this.fieldValueRepository.save(existing
      ? Object.assign(existing, { value })
      : this.fieldValueRepository.create({ value, plugin: { id: plugin.id }, field: { id: field.id } }))
  }
}
