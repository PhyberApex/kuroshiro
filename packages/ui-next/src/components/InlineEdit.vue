<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import Button from './Button.vue'
import FieldError from './FieldError.vue'

const props = defineProps<{
  /** The value as it stands. It is shown while nothing is edited and is what the input starts from. */
  value: string
  /** The input's accessible name: "Name of Weather". */
  label: string
  /** Says what is wrong with a value, or nothing when it may be saved. A refused value is not emitted. */
  validate?: (value: string) => string | undefined
  /** A refusal from outside, such as the server's. It shows like one from `validate`. */
  error?: string
  /** The save is running: "Save" shows the loading mark and nothing can be changed. */
  saving?: boolean
}>()

const emit = defineEmits<{
  /** A changed, valid value. The parent saves it and ends the editing when that worked. */
  save: [value: string]
}>()

/** Whether the input is shown. Whatever starts the editing ("Rename") sets it and gets the focus back when it ends. */
const editing = defineModel<boolean>('editing', { default: false })

const errorId = useId()
const input = useTemplateRef('input')
const draft = ref(props.value)
const refusal = ref<string>()
const problem = computed(() => refusal.value ?? props.error)
let trigger: Element | null = null

// Synchronous, so the element that started the editing still has the focus when it is read.
watch(editing, (isEditing) => {
  if (isEditing) {
    trigger = document.activeElement
    draft.value = props.value
    refusal.value = undefined
    nextTick(() => {
      input.value?.focus()
      input.value?.select()
    })
  }
  else if (trigger instanceof HTMLElement) {
    trigger.focus()
  }
}, { flush: 'sync' })

function cancel() {
  if (!props.saving)
    editing.value = false
}

function save() {
  if (props.saving)
    return
  refusal.value = props.validate?.(draft.value)
  if (refusal.value)
    return
  if (draft.value === props.value)
    cancel()
  else
    emit('save', draft.value)
}

function onTyped(event: Event) {
  draft.value = (event.target as HTMLInputElement).value
  refusal.value = undefined
}
</script>

<template>
  <div v-if="editing" class="inline-edit" @keydown.esc="cancel">
    <input
      ref="input"
      class="control prose input"
      :value="draft"
      :readonly="saving"
      :aria-label="label"
      :aria-invalid="Boolean(problem) || undefined"
      :aria-describedby="problem ? errorId : undefined"
      @input="onTyped"
      @keydown.enter.prevent="save"
    >
    <Button variant="primary" :loading="saving" @click="save">
      Save
    </Button>
    <Button :disabled="saving" @click="cancel">
      Cancel
    </Button>
    <FieldError :id="errorId" class="error" :message="problem" />
  </div>
  <span v-else><slot>{{ value }}</slot></span>
</template>

<style scoped>
@layer components {
  .inline-edit {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--space-2);
    max-width: 100%;
  }

  .input {
    width: 14rem;
    min-width: 0;
    font-weight: var(--weight-semibold);
  }

  /* The value is a name, so it is edited at the size it is read at. Touch keeps the 16 px of every input. */
  @media not (pointer: coarse) {
    .input {
      font-size: var(--text-md);
    }
  }

  .error {
    flex-basis: 100%;
  }
}
</style>
