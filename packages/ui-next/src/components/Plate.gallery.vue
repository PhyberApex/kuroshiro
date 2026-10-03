<script setup lang="ts">
import { screenArt } from '@/gallery/screenArt'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Plate from './Plate.vue'

const landscape = screenArt(800, 480)
const portrait = screenArt(480, 800)
const strip = screenArt(64, 32)
</script>

<template>
  <SpecimenRow title="Current Screen, 576 px">
    <Specimen caption="with the seal: the Active Screen" wide>
      <div class="under-seal">
        <Plate name="On Kitchen: Calendar" :src="landscape" size="current" sealed />
      </div>
    </Specimen>
    <Specimen caption="without: a Fallback Screen, a mirrored image, an offline Device" wide>
      <Plate name="On Hallway: Mirrored from TRMNL" :src="landscape" size="current" />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Preview, as wide as its place">
    <Specimen caption="image">
      <div class="place">
        <Plate name="Preview of Weather" :src="landscape" />
      </div>
    </Specimen>
    <Specimen caption="loading: the dither">
      <div class="place">
        <Plate name="Preview of Weather" rendering />
      </div>
    </Specimen>
    <Specimen caption="error">
      <div class="place">
        <Plate name="Preview of Weather" failed />
      </div>
    </Specimen>
    <Specimen caption="something else in the frame">
      <div class="place">
        <Plate name="Preview of Weather">
          <p class="held">
            Nothing to preview yet
          </p>
        </Plate>
      </div>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="List thumbnail, 168 px, 112 px on phone">
    <Specimen caption="image">
      <Plate name="On Kitchen: Calendar" :src="landscape" size="list" lazy />
    </Specimen>
    <Specimen caption="loading">
      <Plate name="On Hallway: Weather" size="list" />
    </Specimen>
    <Specimen caption="error">
      <Plate name="On Study: Train departures" size="list" failed />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Row thumbnail, 72 px">
    <Specimen caption="active, with the small seal">
      <div class="under-seal">
        <Plate name="Calendar" :src="landscape" size="row" sealed />
      </div>
    </Specimen>
    <Specimen caption="default">
      <Plate name="Weather" :src="landscape" size="row" />
    </Specimen>
    <Specimen caption="passed over">
      <Plate name="Weekend board" :src="landscape" size="row" passed-over />
    </Specimen>
    <Specimen caption="never rendered">
      <Plate name="Train departures" size="row" />
    </Specimen>
    <Specimen caption="error">
      <Plate name="Photo" size="row" failed />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Any Device Model keeps its ratio">
    <Specimen caption="800 × 480">
      <Plate name="Calendar on a landscape panel" :src="landscape" size="list" />
    </Specimen>
    <Specimen caption="480 × 800">
      <Plate name="Calendar on a portrait panel" :src="portrait" size="list" />
    </Specimen>
    <Specimen caption="64 × 32">
      <Plate name="Calendar on a Tidbyt" :src="strip" size="list" />
    </Specimen>
    <Specimen caption="1872 × 1404, rendering: the shape is known before the image">
      <Plate name="Calendar on a large panel" size="list" :width="1872" :height="1404" />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .place {
    width: 15rem;
  }

  /* The seal hangs over the frame, so the plate under it keeps clear of what is above and beside it. */
  .under-seal {
    justify-self: stretch;
    padding: var(--space-4) var(--space-4) 0 0;
  }

  .held {
    padding: var(--space-3);
    font-size: var(--text-sm);
    text-align: center;
  }
}
</style>
