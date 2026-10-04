<script setup lang="ts">
import type { OfferedFieldType, PluginFieldDraft } from './pluginFields'
import type { SelectOption } from '@/components/selectOption'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import Checkbox from '@/components/Checkbox.vue'
import Field from '@/components/Field.vue'
import Select from '@/components/Select.vue'
import Textarea from '@/components/Textarea.vue'
import TextInput from '@/components/TextInput.vue'
import { CREDIT_TYPE, FIELD_TYPE_NAMES, offeredType, typeName } from './pluginFields'
import { fieldId } from './pluginPage'

/** The form of an opened Plugin Field. */
const props = defineProps<{
  /** The path a save sends the Plugin Field at: `fields.2`. */
  path: string
  /** The form's problems, by path. */
  errors: Record<string, string>
}>()

defineEmits<{
  remove: []
}>()

const field = defineModel<PluginFieldDraft>('field', { required: true })

const OFFERED = Object.entries(FIELD_TYPE_NAMES).map(([value, label]): SelectOption => ({ value, label }))
const CREDIT: SelectOption[] = [{ value: CREDIT_TYPE, label: typeName(CREDIT_TYPE) }]

const isCredit = computed(() => field.value.type === CREDIT_TYPE)

/** A type Kuroshiro does not know reads as single-line text and stays as it is written until another is chosen. */
const type = computed({
  get: () => isCredit.value ? CREDIT_TYPE : offeredType(field.value.type),
  set: (chosen: string | null) => {
    if (chosen && chosen !== offeredType(field.value.type))
      field.value.type = chosen as OfferedFieldType
  },
})

const readAs = computed(() => `Templates and Data Sources read {{ ${field.value.keyname.trim()} }}. Changing it starts the Field Value over.`)

const at = (name: string) => `${props.path}.${name}`
</script>

<template>
  <div class="form">
    <Field :id="fieldId(at('keyname'))" v-slot="{ control }" label="Keyname" :hint="readAs" :error="errors[at('keyname')]">
      <TextInput v-model="field.keyname" v-bind="control" wide spellcheck="false" autocapitalize="off" />
    </Field>
    <Field v-slot="{ control }" label="Label">
      <TextInput v-model="field.label" v-bind="control" prose wide />
    </Field>
    <Field v-slot="{ control }" label="Type">
      <Select v-model="type" v-bind="control" class="type" :options="isCredit ? CREDIT : OFFERED" :disabled="isCredit" />
    </Field>
    <Field v-if="field.type !== 'password'" v-slot="{ control }" label="Default">
      <TextInput v-model="field.default" v-bind="control" prose wide placeholder="None" />
    </Field>
    <Field
      v-if="field.type === 'select'"
      :id="fieldId(at('options'))"
      v-slot="{ control }"
      class="full"
      label="Options"
      hint="One per line."
      :error="errors[at('options')]"
    >
      <Textarea v-model="field.options" v-bind="control" class="prose" rows="3" />
    </Field>
    <Field v-slot="{ control }" class="full" label="Help text">
      <TextInput v-model="field.helpText" v-bind="control" prose wide />
    </Field>
    <div class="full foot">
      <Checkbox v-model="field.required">
        Required
      </Checkbox>
      <Button variant="quiet" @click="$emit('remove')">
        Remove Plugin Field
      </Button>
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--space-4);
  }

  .form > * {
    max-width: none;
  }

  .full {
    grid-column: 1 / -1;
  }

  .form :deep(.type) {
    width: 100%;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-6);
  }

  @media (max-width: 820px) {
    .form {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
