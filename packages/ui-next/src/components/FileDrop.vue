<script setup lang="ts">
import { computed, ref, useAttrs, useId } from 'vue'
import Button from './Button.vue'
import FieldError from './FieldError.vue'
import { formatBytes, formatNames, refusalOf } from './fileRules'
import Icon from './Icon.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** The file name endings it takes, each with its dot: `['.png', '.jpg']`. */
  accept: string[]
  /** The largest file it takes, in bytes. */
  maxBytes: number
  /** The sentence that says what to drop. The types and the limit are named after it. */
  prompt?: string
  /** The accepted types as the admin reads them: "PNG, JPEG or WebP". Left out, they are read off `accept`. */
  formats?: string
  disabled?: boolean
  invalid?: boolean
  /** Holds the dragging-over state, for the gallery. */
  draggingOver?: boolean
}>(), {
  prompt: 'Drop a file here.',
})

/** The chosen file. A file of another type or over the limit never gets here: it is refused with a message. */
const model = defineModel<File | null>({ default: null })

const attrs = useAttrs()
const generatedId = useId()
const inputId = computed(() => (attrs.id as string | undefined) ?? generatedId)
const textId = computed(() => `${inputId.value}-text`)
const refusalId = computed(() => `${inputId.value}-refusal`)

const rules = computed(() => ({
  accept: props.accept,
  maxBytes: props.maxBytes,
  formats: props.formats ?? formatNames(props.accept),
}))

const refusal = ref<string>()
const pointerIsOver = ref(false)
const isOver = computed(() => !props.disabled && (props.draggingOver || pointerIsOver.value))

const describedBy = computed(() =>
  [textId.value, refusal.value && refusalId.value, attrs['aria-describedby']].filter(Boolean).join(' '))

function take(file: File | undefined) {
  if (!file || props.disabled)
    return
  refusal.value = refusalOf(file, rules.value)
  if (!refusal.value)
    model.value = file
}

function onChosen(event: Event) {
  const input = event.target as HTMLInputElement
  take(input.files?.[0])
  // The file lives in the model, so the input is emptied and choosing the same file again is a change again.
  input.value = ''
}

function onDrop(event: DragEvent) {
  pointerIsOver.value = false
  take(event.dataTransfer?.files[0])
}

function onDragLeave(event: DragEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    pointerIsOver.value = false
}
</script>

<template>
  <div class="file-drop">
    <div
      class="frame"
      :class="{ over: isOver, invalid: invalid || refusal, disabled }"
      @dragenter.prevent="pointerIsOver = true"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <p :id="textId" class="text">
        <template v-if="isOver">
          Let go to choose this file.
        </template>
        <template v-else-if="model">
          <span class="name">{{ model.name }}</span> <span>{{ formatBytes(model.size) }}</span>
        </template>
        <template v-else>
          {{ prompt }} {{ rules.formats }}, up to {{ formatBytes(maxBytes) }}.
        </template>
      </p>
      <input
        v-bind="$attrs"
        :id="inputId"
        type="file"
        class="visually-hidden input"
        :accept="accept.join(',')"
        :disabled="disabled"
        :aria-invalid="invalid || Boolean(refusal) || undefined"
        :aria-describedby="describedBy"
        @change="onChosen"
      >
      <Button as-child :disabled="disabled">
        <label class="choose" :for="inputId"><Icon name="upload" />Choose file</label>
      </Button>
    </div>
    <FieldError :id="refusalId" :message="refusal" />
  </div>
</template>

<style scoped>
@layer components {
  .frame {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px dashed var(--color-ink-soft);
    border-radius: var(--radius);
    color: var(--color-ink-soft);
    transition:
      background-color var(--duration-quick) var(--ease-out),
      border-color var(--duration-quick) var(--ease-out),
      color var(--duration-quick) var(--ease-out);
  }

  .over {
    border-style: solid;
    border-color: var(--color-ink);
    background: var(--color-wash);
    color: var(--color-ink);
  }

  .invalid {
    border-style: solid;
    border-color: var(--color-ink);
    box-shadow: inset 0 0 0 1px var(--color-ink);
  }

  .disabled {
    border-color: var(--color-line);
  }

  .text {
    flex: 1 1 12rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .name {
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .choose {
    gap: var(--space-2);
    color: var(--color-ink);
  }

  /* The input is the control and is out of sight, so its label draws the focus ring for it. */
  .input:focus-visible + .choose,
  .input[data-force~='focus'] + .choose {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }
}
</style>
