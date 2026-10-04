<script setup lang="ts">
import type { DeviceModelRead, PaletteRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'
import { customPalettesByName } from './deviceModelsWording'
import InstanceSection from './InstanceSection.vue'
import PaletteDeletion from './PaletteDeletion.vue'
import PaletteForm from './PaletteForm.vue'
import PaletteRow from './PaletteRow.vue'

const props = defineProps<{
  palettes: PaletteRead[]
  models: DeviceModelRead[]
}>()

defineEmits<{
  /** A custom Palette was added, changed or deleted: what the page shows is to be read again. */
  changed: []
}>()

const route = useRoute()

const custom = computed(() => customPalettesByName(props.palettes))
/** Whose form is open, from `?palette=`: `new`, or the id of a custom Palette. One form is open at a time. */
const open = computed(() => typeof route.query.palette === 'string' ? route.query.palette : undefined)
const formFor = (palette?: PaletteRead) => ({ query: { palette: palette?.id ?? 'new' } })
</script>

<template>
  <InstanceSection id="custom-palettes" title="Custom Palettes">
    <template #aside>
      <Button as-child>
        <RouterLink :to="formFor()">
          <Icon name="plus" />Add a custom Palette
        </RouterLink>
      </Button>
    </template>
    <div v-if="open === 'new'" class="new-form">
      <PaletteForm :palettes="palettes" @saved="$emit('changed')" />
    </div>
    <ul v-if="custom.length > 0">
      <PaletteRow v-for="palette in custom" :key="palette.id" :palette="palette">
        <template #actions>
          <Button as-child>
            <RouterLink :to="formFor(palette)" :aria-label="`Edit ${palette.name}`">
              Edit
            </RouterLink>
          </Button>
          <PaletteDeletion :palette="palette" :models="models" :palettes="palettes" @deleted="$emit('changed')" />
        </template>
        <template v-if="open === palette.id" #form>
          <PaletteForm :palette="palette" :palettes="palettes" @saved="$emit('changed')" />
        </template>
      </PaletteRow>
    </ul>
    <p v-else-if="open !== 'new'" class="none">
      None yet. A colour panel rarely shows the exact red or yellow TRMNL's Palette assumes. A custom Palette holds the colours your panel really shows, so images are reduced to those.
    </p>
  </InstanceSection>
</template>

<style scoped>
@layer components {
  .none {
    max-width: var(--measure);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .new-form {
    padding: var(--space-4) 0 var(--space-5);
    border-bottom: var(--rule);
  }
}
</style>
