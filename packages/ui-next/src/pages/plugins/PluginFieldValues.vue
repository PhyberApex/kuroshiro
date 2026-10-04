<script setup lang="ts">
import { computed, watch } from 'vue'
import PageSection from '@/patterns/PageSection.vue'
import FieldValueRow from './FieldValueRow.vue'
import { pluginFields } from './pluginFields'
import { creditOf, enteredFields, pluginFieldValues, valuesAmong } from './pluginFieldValues'
import { usePluginFormPart, usePluginPage } from './pluginPage'

const { plugin, form } = usePluginPage()

const part = usePluginFormPart(pluginFieldValues)

/** The Plugin Fields as the form holds them, so one that is added, renamed, retyped, moved or removed shows here before it is saved. */
const fields = computed(() => form.unsaved.fields ?? pluginFields.toInput(pluginFields.read(plugin.value)).fields ?? [])
const rows = computed(() => enteredFields(fields.value))
const credit = computed(() => creditOf(fields.value))

function isSecretStored(keyname: string) {
  const stored = plugin.value.fieldValues[keyname]
  return stored?.secret === true && stored.set
}

/**
 * An emptied value with nothing saved under its keyname leaves the draft, so it is not sent: that keeps a stored
 * password whose replacement was taken back, and makes no change of a new Plugin Field that was typed in and emptied.
 */
function enter(keyname: string, value: string) {
  if (value === '' && !(keyname in part.saved.values))
    delete part.draft.values[keyname]
  else
    part.draft.values[keyname] = value
}

watch(() => rows.value.map(field => field.keyname).join('\n'), () => {
  const values = valuesAmong(rows.value.map(field => field.keyname), part.draft.values, part.saved.values)
  if (JSON.stringify(values) !== JSON.stringify(part.draft.values))
    part.draft.values = values
})
</script>

<template>
  <PageSection v-if="fields.length > 0" id="values" title="Field Values" rows>
    <FieldValueRow
      v-for="field in rows"
      :key="field.keyname"
      :model-value="part.draft.values[field.keyname] ?? ''"
      :field="field"
      :secret-stored="isSecretStored(field.keyname)"
      @update:model-value="enter(field.keyname, $event)"
    />
    <template #under>
      Every Device and every Mashup shows {{ plugin.name }} with these values. To show it with other values somewhere, duplicate the Plugin.
      <span v-if="credit" class="credit">{{ credit }}</span>
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  .credit {
    display: block;
    margin-top: var(--space-2);
    font-size: var(--text-sm);
  }
}
</style>
