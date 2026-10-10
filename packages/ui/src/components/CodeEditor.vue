<script setup lang="ts">
import type { CodeEditorMode, CodeEditorSize, CodeProblem, CodeValidity } from './codeEditor'
import type { CodeEditor } from './codeEditorView'
import { computed, onBeforeUnmount, onMounted, ref, useAttrs, useTemplateRef, watch } from 'vue'
import CodeEditorStrip from './CodeEditorStrip.vue'
import Notice from './Notice.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Read once, when the editor is made. For another mode, mount another editor. */
  mode: CodeEditorMode
  /** Read once, like the mode. */
  size?: CodeEditorSize
  /** The text can be read, selected and copied, and not changed. */
  readOnly?: boolean
  /** Draws the doubled ink border and sets `aria-invalid`. The message is the caller's. */
  invalid?: boolean
  /** Takes the hint's place in the strip: "This template is removed when you save." */
  stripNote?: string
  /** A problem the caller found, for an editor with a strip: marked in the code and the gutter, worded in the strip. The Template section finds them in Liquid; HTML is never invalid. */
  problem?: CodeProblem | null
  /** Liquid only: the data the preview renders with. Completion offers its names and the keys under them. */
  completionData?: Record<string, unknown>
  /** Liquid only: the names of Kuroshiro's own filters, which completion marks "Kuroshiro". */
  kuroshiroFilters?: readonly string[]
  /** Names the document the text belongs to. When it changes, the document that leaves keeps its undo history and cursor for its return. */
  document?: string
  /** Holds the block shown while the editor is fetched, for the gallery. */
  pending?: boolean
  /** Makes the next fetch of the editor's chunk fail with this, in place of running it. For a spec, not a caller. */
  chunkFailure?: Error
}>(), {
  size: 'bench',
  problem: null,
  completionData: () => ({}),
  kuroshiroFilters: () => [],
  document: '',
})

const emit = defineEmits<{
  /** The focus left the editor, its search and its strip. */
  blur: []
  /** Ctrl or Cmd S was pressed in the editor. The browser's own save is always held back. */
  save: []
  /** JSON only: whether the text parses, when the editor is made and at every change. */
  validity: [validity: CodeValidity]
}>()

const text = defineModel<string>({ default: '' })

const attrs = useAttrs()

if (import.meta.env.DEV && !attrs['aria-label'] && !attrs['aria-labelledby'])
  throw new Error('A CodeEditor needs a name: give it aria-label or aria-labelledby. A label\'s `for` does not name it.')

/** The attributes that name or describe a control. They belong on the element that is typed in, not on the frame. */
const FOR_THE_TYPED_IN = /^(?:id$|aria-)/
const isSet = (value: unknown) => value !== undefined && value !== null && value !== false

const frameAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([name]) => !FOR_THE_TYPED_IN.test(name))))
const typedInAttrs = computed<Record<string, string>>(() => ({
  ...Object.fromEntries(Object.entries(attrs)
    .filter(([name, value]) => FOR_THE_TYPED_IN.test(name) && isSet(value))
    .map(([name, value]) => [name, String(value)])),
  ...(props.invalid ? { 'aria-invalid': 'true' } : {}),
}))

const frame = useTemplateRef('frame')
const host = useTemplateRef('host')
const editor = ref<CodeEditor>()
const failed = ref(false)
let unmounted = false

const hasStrip = computed(() => props.size !== 'code-input')

const completion = computed(() => ({ data: props.completionData, filters: props.kuroshiroFilters }))

async function fetchEditor() {
  try {
    if (props.chunkFailure)
      throw props.chunkFailure
    const chunk = await import('./codeEditorView')
    const { createCodeEditor } = chunk
    if (unmounted)
      return
    failed.value = false
    editor.value = createCodeEditor({
      parent: host.value!,
      text: text.value,
      document: props.document,
      mode: props.mode,
      size: props.size,
      readOnly: props.readOnly,
      attributes: typedInAttrs.value,
      completion: completion.value,
      problem: props.problem,
      onChange: value => text.value = value,
      onSave: () => emit('save'),
      onValidity: validity => emit('validity', validity),
    })
  }
  catch {
    if (!unmounted)
      failed.value = true
  }
}

onMounted(() => {
  if (!props.pending)
    fetchEditor()
})

onBeforeUnmount(() => {
  unmounted = true
  editor.value?.destroy()
})

watch([() => props.document, text], ([document], [shownDocument]) => {
  if (document === shownDocument)
    editor.value?.setText(text.value)
  else
    editor.value?.show(document, text.value)
})
watch(() => props.readOnly, readOnly => editor.value?.setReadOnly(readOnly))
watch(typedInAttrs, attributes => editor.value?.setAttributes(attributes))
watch(completion, next => editor.value?.setCompletion(next))
watch(() => props.problem, problem => editor.value?.setProblem(problem))

function reportFocusLeaving(event: FocusEvent) {
  if (!frame.value?.contains(event.relatedTarget as Node | null))
    emit('blur')
}

defineExpose({
  focus: () => editor.value?.focus(),
  /** Puts the cursor at the start of a line, scrolls it into view and takes the focus. */
  goToLine: (line: number) => editor.value?.goToLine(line),
})
</script>

<template>
  <div
    ref="frame"
    class="code-editor"
    :class="[size, { 'is-loading': !editor && !failed }]"
    :data-invalid="invalid || undefined"
    :aria-busy="(!editor && !pending && !failed) || undefined"
    v-bind="frameAttrs"
    @focusout="reportFocusLeaving"
  >
    <Notice
      v-if="failed"
      title="The code editor could not be loaded."
      reason="Kuroshiro's server is not answering. If Kuroshiro was updated meanwhile, reload the page."
      action="Try again"
      @act="fetchEditor"
    />
    <div v-show="!failed" ref="host" class="host" />
    <CodeEditorStrip
      v-if="hasStrip && editor"
      :mode="mode"
      :problem="problem"
      :note="stripNote"
      @go-to-problem="editor.goToProblem()"
    />
  </div>
</template>

<style scoped>
@layer components {
  .code-editor {
    --code-size: var(--text-xs);
    --code-leading: 1.65;
    --code-pad: var(--space-3);
    --code-field-size: var(--text-xs);

    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    height: 27rem;
    overflow: hidden;
    border: var(--rule-control);
    border-radius: var(--radius);
    background: var(--color-paper);
    transition: border-color var(--duration-quick) var(--ease-out);
  }

  .full-window {
    --code-size: var(--text-sm);

    height: 100%;
    min-height: 0;
  }

  .code-input {
    --code-pad: var(--space-2);

    grid-template-rows: auto;
    width: 100%;
    height: auto;
    /* Three lines, as the editor that arrives is at its smallest. */
    min-height: calc(3 * var(--code-leading) * var(--code-size) + 2 * var(--code-pad) + 2px);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the editor. */
  .code-editor:is(:hover, [data-force~='hover']) {
    border-color: var(--color-ink);
  }

  .code-editor:is(:has(.cm-editor.cm-focused), [data-force~='focus']) {
    border-color: var(--color-ink);
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }

  /* An error is ink, never red: the border doubles. */
  .code-editor[data-invalid] {
    border-color: var(--color-ink);
    box-shadow: inset 0 0 0 1px var(--color-ink);
  }

  /* Until the editor has been fetched, its place is held by a block of its height. */
  .code-editor.is-loading {
    border-color: transparent;
    background: var(--color-wash);
    box-shadow: none;
  }

  .host {
    min-width: 0;
    min-height: 0;
  }

  /* The full window is not offered on a phone; an editor asked to fill one there is as high as the one on the bench. */
  @media (max-width: 820px) {
    .bench,
    .full-window {
      height: 20rem;
    }
  }

  /* 16 px, so iOS does not zoom into the focused editor. */
  @media (pointer: coarse) {
    .code-editor {
      --code-size: var(--text-lg);
      --code-field-size: var(--text-lg);
    }
  }
}
</style>
