<script setup lang="ts">
import type { PluginFieldInput } from 'kuroshiro-shared'
import { computed, watch } from 'vue'
import PageSection from '@/patterns/PageSection.vue'
import FieldValueRow from './FieldValueRow.vue'
import { creditOf, fieldsWithRow, isSecretStored, pluginFieldValues, valuesAmong } from './pluginFieldValues'
import { usePluginFormPart, usePluginPage } from './pluginPage'

const { plugin, form } = usePluginPage()

const part = usePluginFormPart(pluginFieldValues)

/** The Plugin Fields as the form holds them, so one that is added, renamed, retyped, moved or removed shows here before it is saved. */
const fields = computed(() => form.unsaved.fields ?? [])
const rows = computed(() => fieldsWithRow(fields.value))
const credit = computed(() => creditOf(fields.value))

const keepsSecret = (field: PluginFieldInput) => field.fieldType === 'password' && isSecretStored(plugin.value, field.keyname)

const keynames = computed(() => rows.value.map(field => field.keyname))
const clearedSecrets = computed(() => rows.value
  .filter(field => field.fieldType !== 'password' && isSecretStored(plugin.value, field.keyname))
  .map(field => field.keyname))

const valuesWith = (entered: Record<string, string>) => valuesAmong(keynames.value, entered, part.saved.values, clearedSecrets.value)

function enter(keyname: string, value: string) {
  part.draft.values = valuesWith({ ...part.draft.values, [keyname]: value })
}

watch(() => JSON.stringify([keynames.value, clearedSecrets.value]), () => {
  const values = valuesWith(part.draft.values)
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
      :secret-stored="keepsSecret(field)"
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
