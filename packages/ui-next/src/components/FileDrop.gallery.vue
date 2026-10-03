<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import FileDrop from './FileDrop.vue'

const IMAGE_ENDINGS = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp']
const IMAGE_FORMATS = 'PNG, JPEG, BMP, GIF, TIFF or WebP'
const TEN_MEGABYTES = 10 * 1024 * 1024

const image = ref<File | null>(null)
const chosen = ref<File | null>(new File([new Uint8Array(640 * 1024)], 'kitchen-window.png', { type: 'image/png' }))
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default: drop a file on it, or choose one" wide>
      <div class="sized">
        <FileDrop
          v-model="image"
          prompt="Drop an image here."
          :accept="IMAGE_ENDINGS"
          :formats="IMAGE_FORMATS"
          :max-bytes="TEN_MEGABYTES"
        />
      </div>
    </Specimen>
    <Specimen caption="dragging over" wide>
      <div class="sized">
        <FileDrop
          prompt="Drop an image here."
          :accept="IMAGE_ENDINGS"
          :formats="IMAGE_FORMATS"
          :max-bytes="TEN_MEGABYTES"
          dragging-over
        />
      </div>
    </Specimen>
    <Specimen caption="focus" wide>
      <div class="sized">
        <FileDrop
          prompt="Drop a .zip here: a Plugin as Kuroshiro or TRMNL exports it."
          :accept="['.zip']"
          :max-bytes="TEN_MEGABYTES"
          data-force="focus"
        />
      </div>
    </Specimen>
    <Specimen caption="a file is chosen" wide>
      <div class="sized">
        <FileDrop
          v-model="chosen"
          prompt="Drop an image here."
          :accept="IMAGE_ENDINGS"
          :formats="IMAGE_FORMATS"
          :max-bytes="TEN_MEGABYTES"
        />
      </div>
    </Specimen>
    <Specimen caption="disabled" wide>
      <div class="sized">
        <FileDrop
          prompt="Drop an image here."
          :accept="IMAGE_ENDINGS"
          :formats="IMAGE_FORMATS"
          :max-bytes="TEN_MEGABYTES"
          disabled
        />
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .sized {
    justify-self: stretch;
    max-width: 30rem;
  }
}
</style>
