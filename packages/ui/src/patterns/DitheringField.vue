<script setup lang="ts">
import Field from '@/components/Field.vue'
import Switch from '@/components/Switch.vue'

defineProps<{
  /** The look while the change is being saved. */
  saving?: boolean
  /** The look after a change that could not be saved. */
  error?: boolean
  /** The switch's id. Left out, one is made up. */
  id?: string
}>()

defineSlots<{
  /** The save state, beside the switch. */
  status?: () => unknown
}>()

const on = defineModel<boolean>({ default: true })
</script>

<template>
  <Field
    :id="id"
    v-slot="{ control }"
    label="Dithering"
    hint="On for photos, gradients and mixed content, what TRMNL calls Art. Off for pure text and line art, for sharper edges."
  >
    <Switch :id="control.id" v-model="on" :aria-describedby="control['aria-describedby']" :saving="saving" :error="error">
      {{ on ? 'On' : 'Off' }}
      <template #status>
        <slot name="status" />
      </template>
    </Switch>
  </Field>
</template>
