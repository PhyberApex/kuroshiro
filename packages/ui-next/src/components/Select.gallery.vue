<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Select from './Select.vue'

const PALETTES = [
  { value: 'bw', label: '1-bit, black and white' },
  { value: 'gray-4', label: '2-bit, 4 greys' },
  { value: 'gray-16', label: '4-bit, 16 greys' },
  { value: 'color-6', label: 'Colour, 6 inks', disabled: true, reason: 'Not on TRMNL OG' },
]

const DEVICE_MODELS = [
  'TRMNL OG',
  'TRMNL OG, 2-bit',
  'TRMNL X',
  'Kindle Paperwhite 3',
  'Kindle Paperwhite 5',
  'Kobo Libra 2',
  'Kobo Clara HD',
  'Inkplate 10',
  'Inkplate 6',
  'Waveshare 7.5 inch',
  'Seeed reTerminal E1001',
  'M5Paper S3',
].map(label => ({ value: label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'), label }))

const palette = ref<string | null>('gray-4')
const noPalette = ref<string | null>(null)
const deviceModel = ref<string | null>('trmnl-og')
</script>

<template>
  <SpecimenRow title="A list">
    <Specimen caption="default">
      <Select v-model="palette" :options="PALETTES" aria-label="Palette" />
    </Specimen>
    <Specimen caption="nothing chosen">
      <Select v-model="noPalette" :options="PALETTES" placeholder="Choose a Palette" aria-label="Palette" />
    </Specimen>
    <Specimen caption="hover">
      <Select v-model="palette" :options="PALETTES" aria-label="Palette" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <Select v-model="palette" :options="PALETTES" aria-label="Palette" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <Select v-model="palette" :options="PALETTES" aria-label="Palette" disabled />
    </Specimen>
    <Specimen caption="invalid">
      <Select v-model="noPalette" :options="PALETTES" placeholder="Choose a Palette" aria-label="Palette" invalid />
    </Specimen>
    <Specimen caption="open: press it. One option cannot be chosen">
      <Select v-model="palette" :options="PALETTES" aria-label="Palette" />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="A long list: a combobox, type to filter">
    <Specimen caption="default">
      <Select v-model="deviceModel" :options="DEVICE_MODELS" aria-label="Device Model" />
    </Specimen>
    <Specimen caption="focus">
      <Select v-model="deviceModel" :options="DEVICE_MODELS" aria-label="Device Model" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <Select v-model="deviceModel" :options="DEVICE_MODELS" aria-label="Device Model" disabled />
    </Specimen>
  </SpecimenRow>
</template>
