<script setup lang="ts">
import Field from '@/components/Field.vue'
import TextInput from '@/components/TextInput.vue'

defineProps<{
  /** What is wrong with the name: "A Screen needs a name." */
  error?: string
}>()

const name = defineModel<string>({ required: true })
</script>

<template>
  <Field v-slot="{ control }" class="screen-name" label="Name" :error="error">
    <TextInput v-model="name" v-bind="control" prose wide autocomplete="off" />
  </Field>
</template>

<style scoped>
@layer components {
  .field.screen-name {
    max-width: none;
  }
}
</style>
