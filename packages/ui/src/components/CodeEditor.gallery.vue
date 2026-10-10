<script setup lang="ts">
import { ref } from 'vue'
import {
  BROKEN_HEADERS_JSON,
  FRIDGE_NOTE_HTML,
  HEADERS_JSON,
  KUROSHIRO_FILTER_NAMES,
  TRANSFORM_JAVASCRIPT,
  UNCLOSED_PROBLEM,
  UNCLOSED_TEMPLATE,
  WEATHER_DATA,
  WEATHER_TEMPLATE,
} from '@/gallery/editorSamples'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import CodeEditor from './CodeEditor.vue'

const template = ref(WEATHER_TEMPLATE)
const hovered = ref(WEATHER_TEMPLATE)
const focused = ref(WEATHER_TEMPLATE)
const unclosed = ref(UNCLOSED_TEMPLATE)
const refused = ref(UNCLOSED_TEMPLATE)
const removed = ref(WEATHER_TEMPLATE)
const wide = ref(WEATHER_TEMPLATE)
const html = ref(FRIDGE_NOTE_HTML)
const headers = ref(HEADERS_JSON)
const brokenHeaders = ref(BROKEN_HEADERS_JSON)
const body = ref('')
const longBody = ref(JSON.stringify({ stations: Array.from({ length: 12 }, (_, index) => `Lindenplatz ${index + 1}`) }, null, 2))
const transform = ref(TRANSFORM_JAVASCRIPT)
const CHUNK_FAILURE = new Error('offline')
</script>

<template>
  <SpecimenRow title="Liquid, on the bench: 27 rem, 20 rem on phone">
    <Specimen caption="default: type {{ or {% for completion, Ctrl F for search, Esc then Tab to move on" wide>
      <CodeEditor
        v-model="template"
        class="stretch"
        mode="liquid"
        :completion-data="WEATHER_DATA"
        :kuroshiro-filters="KUROSHIRO_FILTER_NAMES"
        aria-label="Template of Weather, Full"
      />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="States">
    <Specimen caption="hover">
      <CodeEditor v-model="hovered" class="state" mode="liquid" aria-label="Template, hovered" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <CodeEditor v-model="focused" class="state" mode="liquid" aria-label="Template, focused" data-force="focus" />
    </Specimen>
    <Specimen caption="problem: hover the mark for the message">
      <CodeEditor v-model="unclosed" class="state" mode="liquid" :problem="UNCLOSED_PROBLEM" aria-label="Template with a problem" />
    </Specimen>
    <Specimen caption="invalid: a problem that blocks the save">
      <CodeEditor v-model="refused" class="state" mode="liquid" :problem="UNCLOSED_PROBLEM" invalid aria-label="Template that cannot be saved" />
    </Specimen>
    <Specimen caption="read-only, with a strip note">
      <CodeEditor
        v-model="removed"
        class="state"
        mode="liquid"
        read-only
        strip-note="This template is removed when you save."
        aria-label="Template that is removed"
      />
    </Specimen>
    <Specimen caption="until the editor has been fetched">
      <CodeEditor class="state" mode="liquid" pending aria-label="Template on its way" />
    </Specimen>
    <Specimen caption="the editor's chunk could not be fetched">
      <CodeEditor class="state" mode="liquid" :chunk-failure="CHUNK_FAILURE" aria-label="Template that could not be loaded" />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="HTML and the full window">
    <Specimen caption="HTML: nothing is Liquid, so nothing is wash">
      <CodeEditor v-model="html" class="state" mode="html" aria-label="HTML of Fridge note" />
    </Specimen>
    <Specimen caption="full window: fills the height of its place, at text-sm">
      <div class="window">
        <CodeEditor v-model="wide" mode="liquid" size="full-window" aria-label="Template in the full window" />
      </div>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Code input: from 3 lines to 15 rem, then it scrolls">
    <Specimen caption="JSON">
      <CodeEditor v-model="headers" class="input" mode="json" size="code-input" aria-label="Headers" />
    </Specimen>
    <Specimen caption="JSON, empty">
      <CodeEditor v-model="body" class="input" mode="json" size="code-input" aria-label="Body" />
    </Specimen>
    <Specimen caption="JSON that does not parse, invalid once the field is left">
      <CodeEditor v-model="brokenHeaders" class="input" mode="json" size="code-input" invalid aria-label="Headers that do not parse" />
    </Specimen>
    <Specimen caption="JSON, longer than 15 rem">
      <CodeEditor v-model="longBody" class="input" mode="json" size="code-input" aria-label="Literal value" />
    </Specimen>
    <Specimen caption="JavaScript: highlighted, not checked">
      <CodeEditor v-model="transform" class="input wider" mode="javascript" size="code-input" aria-label="Transform" />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }

  /* A specimen is as wide as what it holds, so the width that is left on a phone is the window's. */
  .code-editor.state,
  .window {
    width: min(27rem, 100vw - 3rem);
    height: 14rem;
  }

  @media (max-width: 820px) {
    .window {
      height: auto;
    }
  }

  .code-editor.input {
    width: min(20rem, 100vw - 3rem);
  }

  .code-editor.input.wider {
    width: min(34rem, 100vw - 3rem);
  }
}
</style>
