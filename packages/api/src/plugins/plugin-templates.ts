import type { TemplateSize } from 'kuroshiro-shared'
import type { PluginTemplate } from './entities/plugin-template.entity.js'
import { TEMPLATE_SIZES } from 'kuroshiro-shared'

const SLOT_SIZE_PREFIX = 'view--'

/** The Template every render of that size uses: the Plugin's own of the size, else its `full` one. */
export function templateOfSize(templates: PluginTemplate[] | undefined, size: TemplateSize): PluginTemplate | undefined {
  return templates?.find(template => template.layout === size) ?? templates?.find(template => template.layout === 'full')
}

/** A Mashup slot stores its size as the CSS class `view--half_vertical`; the Template of that size is `half_vertical`. */
export function templateSizeOfSlot(slotSize: string): TemplateSize {
  const size = slotSize.startsWith(SLOT_SIZE_PREFIX) ? slotSize.slice(SLOT_SIZE_PREFIX.length) : slotSize
  return TEMPLATE_SIZES.find(candidate => candidate === size) ?? 'full'
}
