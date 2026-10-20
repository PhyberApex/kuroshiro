<script setup lang="ts">
import type { PluginFieldInput } from 'kuroshiro-shared'
import { computed } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import SecretField from '@/components/SecretField.vue'
import Select from '@/components/Select.vue'
import Switch from '@/components/Switch.vue'
import Textarea from '@/components/Textarea.vue'
import TextInput from '@/components/TextInput.vue'
import FieldValueChecklist from './FieldValueChecklist.vue'
import { fieldControl, isOn, OFF, ON } from './pluginFieldValues'

defineOptions({ inheritAttrs: false })

/** The control one Field Value is entered with, by its Plugin Field's type. What it holds is the value as the server stores it: text. */
const props = defineProps<{
  field: PluginFieldInput
  /** What the row calls the Plugin Field. */
  label: string
  /** Whether the server holds a password for it, which never reaches the browser. */
  secretStored: boolean
  invalid: boolean
}>()

const entered = defineModel<string>({ required: true })

const kind = computed(() => fieldControl(props.field.fieldType, props.field.attributes))

const on = computed({
  get: () => isOn(entered.value, props.field.defaultValue),
  set: (switched) => {
    entered.value = switched ? ON : OFF
  },
})

const number = computed({
  get: () => entered.value.trim() === '' || !Number.isFinite(Number(entered.value)) ? null : Number(entered.value),
  set: (typed) => {
    entered.value = typed === null ? '' : String(typed)
  },
})

const options = computed(() => (props.field.options ?? []).filter(option => option.value !== ''))

const attributes = computed(() => props.field.attributes ?? {})
const placeholder = computed(() => attributes.value.placeholder ?? props.field.defaultValue)
const inputType = computed(() => kind.value === 'url' || kind.value === 'date' || kind.value === 'time' ? kind.value : 'text')

const chosen = computed({
  get: () => entered.value || props.field.defaultValue || null,
  set: (value) => {
    entered.value = value ?? ''
  },
})
</script>

<template>
  <Textarea v-if="kind === 'textarea'" v-bind="$attrs" v-model="entered" class="prose" :rows="attributes.rows ?? 3" :maxlength="attributes.maxlength" :invalid="invalid" :placeholder="placeholder" />
  <NumberInput v-else-if="kind === 'number'" v-bind="$attrs" v-model="number" wide :invalid="invalid" :placeholder="placeholder" :min="attributes.min" :max="attributes.max" :step="attributes.step" />
  <template v-else-if="kind === 'switch'">
    <Switch v-bind="$attrs" v-model="on" :error="invalid" />
    <span>{{ on ? 'On' : 'Off' }}</span>
  </template>
  <Select v-else-if="kind === 'select'" v-bind="$attrs" v-model="chosen" :options="options" :invalid="invalid" placeholder="Not set" />
  <Textarea v-else-if="kind === 'lines'" v-bind="$attrs" v-model="entered" class="prose" :rows="attributes.rows ?? 3" :invalid="invalid" :placeholder="placeholder ?? 'One per line'" />
  <FieldValueChecklist v-else-if="kind === 'checklist'" v-bind="$attrs" v-model="entered" :options="options" :default-value="field.defaultValue" :label="label" :invalid="invalid" />
  <SecretField
    v-else-if="kind === 'secret'"
    v-bind="$attrs"
    v-model="entered"
    :stored="secretStored"
    :invalid="invalid"
    :replace-label="`Replace ${label}`"
    placeholder="Not set"
  />
  <TextInput v-else v-bind="$attrs" v-model="entered" :type="inputType" :prose="inputType === 'text'" wide :invalid="invalid" :placeholder="placeholder" :maxlength="attributes.maxlength" />
</template>
