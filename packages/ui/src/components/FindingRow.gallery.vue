<script setup lang="ts">
import { reactive, ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import FindingRow from './FindingRow.vue'
import FindingRows from './FindingRows.vue'

const open = ref('uploads')
const ticked = reactive({ images: true, folders: true, temporary: true, uploads: true, screens: false })
</script>

<template>
  <SpecimenRow>
    <Specimen caption="ticked · hover · focus · open · unticked" wide>
      <FindingRows v-model:open="open" class="stretch">
        <FindingRow v-model:ticked="ticked.images" value="images" name="Images no Screen uses" count="6 files" size="412 KB" />
        <FindingRow v-model:ticked="ticked.folders" value="folders" name="Folders of deleted Devices" count="1 folder" size="1.3 MB" force="hover" />
        <FindingRow v-model:ticked="ticked.temporary" value="temporary" name="Temporary files older than a day" count="3 files" size="96 KB" force="focus" />
        <FindingRow v-model:ticked="ticked.uploads" value="uploads" name="Uploads older than a day" count="2 files" size="2.2 MB">
          <p class="inside">
            What the group holds: a sentence, then its files with their sizes, or its Screens.
          </p>
        </FindingRow>
        <FindingRow v-model:ticked="ticked.screens" value="screens" name="Screens whose image is missing" count="1 Screen" />
      </FindingRows>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }

  .inside {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }
}
</style>
