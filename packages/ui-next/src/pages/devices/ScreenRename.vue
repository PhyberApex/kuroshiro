<script setup lang="ts">
import { computed, ref } from 'vue'
import { updateScreen } from '@/api/screens'
import { failureReason } from '@/components/failureReason'
import InlineEdit from '@/components/InlineEdit.vue'
import { screenName, screenNameProblem } from './screenNaming'

const props = defineProps<{
  screenId: string
  /** The name as it is saved, which is empty for a Screen saved without one. */
  name: string
  /** Reads the Screens again, after the name was saved. */
  reload: () => Promise<void>
}>()

/** Whether the name is being edited. "Rename" sets it and gets the focus back when the editing ends. */
const editing = defineModel<boolean>('editing', { default: false })

const saving = ref(false)
const refusal = ref<string>()

const label = computed(() => `Name of ${screenName(props.name)}`)

async function save(entered: string) {
  const name = entered.trim()
  if (name === props.name) {
    editing.value = false
    return
  }
  saving.value = true
  try {
    await updateScreen(props.screenId, { name })
    await props.reload()
    editing.value = false
  }
  catch (error) {
    refusal.value = failureReason(error) ?? 'The name could not be saved.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <InlineEdit
    v-model:editing="editing"
    v-model:error="refusal"
    :value="name"
    :label="label"
    :validate="screenNameProblem"
    :saving="saving"
    @save="save"
  />
</template>
