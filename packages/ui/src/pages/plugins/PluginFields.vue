<script setup lang="ts">
import type { PluginFieldDraft } from './pluginFields'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import Button from '@/components/Button.vue'
import ScreenRows from '@/components/ScreenRows.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { keptRows } from './formRows'
import PluginFieldRow from './PluginFieldRow.vue'
import { addedPluginField, fieldPaths, inOrderOf, pluginFields } from './pluginFields'
import { fieldArrived, usePluginFormPart, usePluginPage } from './pluginPage'

const { plugin } = usePluginPage()

const sectionOpen = ref(false)

/** The key of the row whose form is open. */
const open = ref<string>()

const part = usePluginFormPart(pluginFields, reveal)

const paths = computed(() => fieldPaths(part.draft.rows))
const count = computed(() => keptRows(part.draft.rows).length)
const title = computed(() => count.value > 0 ? `Plugin Fields · ${count.value}` : 'Plugin Fields')
const items = computed(() => part.draft.rows.map((row, index) => ({ id: row.key, name: row.keyname.trim(), index })))

async function reveal(path: string) {
  const row = part.draft.rows[paths.value.findIndex(sent => sent !== undefined && path.startsWith(`${sent}.`))]
  if (!row)
    return
  sectionOpen.value = true
  open.value = row.key
  await fieldArrived(path)
}

async function add() {
  const row = addedPluginField(part.draft.rows)
  part.draft.rows.push(row)
  open.value = row.key
  const keyname = await fieldArrived(`${paths.value.at(-1)}.keyname`)
  keyname?.focus()
  if (keyname instanceof HTMLInputElement)
    keyname.select()
}

const rowId = (key: string) => `plugin-field-${key}`
const addButton = useTemplateRef('addButton')

/** Removing is part of the unsaved form and asks nothing. A Plugin Field that was never saved has nothing to remove at a save, so it goes at once. */
async function remove(row: PluginFieldDraft) {
  open.value = undefined
  if (row.id === null)
    part.draft.rows.splice(part.draft.rows.indexOf(row), 1)
  else
    row.removed = true
  await nextTick()
  const putBack = document.getElementById(rowId(row.key))?.querySelector<HTMLElement>('.put-back')
  const next = putBack ?? addButton.value?.$el as HTMLElement | undefined
  next?.focus()
}

/** A save gives an added row the key of its id: the row that was open stays open by its keyname. */
const openKeyname = computed(() => part.draft.rows.find(row => row.key === open.value)?.keyname)
let lastOpenKeyname: string | undefined
watch(openKeyname, (keyname) => {
  lastOpenKeyname = keyname ?? lastOpenKeyname
})
watch(() => part.draft.rows.map(row => row.key), (keys) => {
  if (open.value !== undefined && !keys.includes(open.value))
    open.value = part.draft.rows.find(row => row.keyname === lastOpenKeyname)?.key
})
</script>

<template>
  <TuckedSection id="fields" v-model:open="sectionOpen" :title="title">
    <p class="about">
      A Plugin Field is one input this Plugin asks you to fill in. What you enter is its Field Value, which templates and Data Sources read by the keyname.
      <template v-if="plugin.recipe">
        These arrived with the Recipe; a Recipe Update Check may offer changes to them.
      </template>
    </p>
    <ScreenRows
      v-if="part.draft.rows.length > 0"
      v-model:open="open"
      class="rows"
      :items="items"
      sortable
      place="place"
      @reorder="part.draft.rows = inOrderOf(part.draft.rows, $event)"
    >
      <template #default="{ item }">
        <PluginFieldRow
          :id="rowId(item.id)"
          v-model:field="part.draft.rows[item.index]!"
          :path="paths[item.index]"
          :errors="part.errors"
          @remove="remove(part.draft.rows[item.index]!)"
        />
      </template>
    </ScreenRows>
    <p v-else class="none">
      {{ plugin.name }} declares none.
    </p>
    <Button ref="addButton" class="add" @click="add">
      Add a Plugin Field
    </Button>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .about {
    max-width: var(--measure);
    text-wrap: pretty;
  }

  .rows {
    margin-top: var(--space-3);
    border-top: var(--rule);
  }

  .none {
    margin-top: var(--space-2);
  }

  .add {
    margin-top: var(--space-3);
  }
}
</style>
