<script setup lang="ts">
import { TRMNL_FRAMEWORK_VERSION } from 'kuroshiro-shared'
import { ref } from 'vue'
import Field from '@/components/Field.vue'
import Switch from '@/components/Switch.vue'
import Textarea from '@/components/Textarea.vue'
import TextInput from '@/components/TextInput.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import DitheringField from '@/patterns/DitheringField.vue'
import { pluginNaming } from './pluginNaming'
import { fieldId, usePluginFormPart } from './pluginPage'

const open = ref(false)

const naming = usePluginFormPart(pluginNaming, () => (open.value = true))
</script>

<template>
  <TuckedSection id="name" v-model:open="open" title="Name and description">
    <div class="fields">
      <Field :id="fieldId('name')" v-slot="{ control }" label="Name" :error="naming.errors.name">
        <TextInput v-model="naming.draft.name" v-bind="control" prose wide />
      </Field>
      <Field :id="fieldId('description')" v-slot="{ control }" class="description" label="Description" :error="naming.errors.description">
        <Textarea
          v-model="naming.draft.description"
          v-bind="control"
          class="prose"
          rows="2"
          placeholder="What this Plugin shows. Only you read it."
        />
      </Field>
      <Field :id="fieldId('frameworkVersion')" label="Framework version" optional :error="naming.errors.frameworkVersion">
        <template #default="{ control }">
          <TextInput v-model="naming.draft.frameworkVersion" v-bind="control" :placeholder="`${TRMNL_FRAMEWORK_VERSION}, this Instance's`" />
        </template>
        <template #hint>
          Leave empty to follow this Instance's version. TRMNL lists its versions under
          <a href="https://trmnl.com/framework/releases" target="_blank" rel="noopener noreferrer">releases</a>.
        </template>
      </Field>
      <DitheringField :id="fieldId('dither')" v-model="naming.draft.dither" />
      <Field :id="fieldId('noScreenPadding')" v-slot="{ control }" label="No screen padding" hint="The Plugin's own Screen draws to the panel's edge, what TRMNL calls no bleed. A Mashup slot keeps its padding.">
        <Switch :id="control.id" v-model="naming.draft.noScreenPadding" :aria-describedby="control['aria-describedby']">
          {{ naming.draft.noScreenPadding ? 'On' : 'Off' }}
        </Switch>
      </Field>
      <Field :id="fieldId('darkMode')" v-slot="{ control }" label="Dark mode" hint="The Plugin's own Screen draws with ink and paper swapped.">
        <Switch :id="control.id" v-model="naming.draft.darkMode" :aria-describedby="control['aria-describedby']">
          {{ naming.draft.darkMode ? 'On' : 'Off' }}
        </Switch>
      </Field>
    </div>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .fields {
    display: grid;
    gap: var(--space-4);
  }

  .fields .description {
    max-width: var(--measure);
  }

  /* Two lines, where a textarea starts out at four. */
  .description :deep(textarea) {
    min-height: calc(2lh + 2 * var(--space-2) + 2px);
  }
}
</style>
