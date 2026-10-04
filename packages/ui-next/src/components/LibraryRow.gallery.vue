<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import Field from './Field.vue'
import LibraryRow from './LibraryRow.vue'
import TextInput from './TextInput.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default" wide>
      <ul class="stretch">
        <LibraryRow name="1.7.9" mono>
          Official · Fits TRMNL OG (1-bit) and TRMNL OG
          <template #end>
            Synced 30 Sept 2026, 04:00
          </template>
        </LibraryRow>
        <LibraryRow name="1.8.0-rc2" mono>
          <p>Custom · Release candidate, battery fix · Fits TRMNL OG</p>
          <p><b class="headed">Goes out to Study at the next poll</b> · Running on Kitchen</p>
          <template #end>
            Uploaded 2 Oct 2026, 09:12
            <Button>Delete</Button>
          </template>
        </LibraryRow>
      </ul>
    </Specimen>
    <Specimen caption="with a problem" wide>
      <ul class="stretch">
        <LibraryRow name="2.0.3" mono problem="Its file is missing, so it cannot be pushed. Delete it and upload it again.">
          Custom · TRMNL X build · Fits TRMNL X
          <template #end>
            Uploaded 12 Sept 2026, 18:40
            <Button>Delete</Button>
          </template>
        </LibraryRow>
      </ul>
    </Specimen>
    <Specimen caption="with a form open under it" wide>
      <ul class="stretch">
        <LibraryRow name="Soft red">
          Black, white and red
          <template #end>
            Study
            <Button>Edit</Button>
            <Button>Delete</Button>
          </template>
          <template #form>
            <form class="form" aria-label="Edit Soft red" @submit.prevent>
              <Field v-slot="{ control }" label="Name">
                <TextInput model-value="Soft red" v-bind="control" prose />
              </Field>
              <div class="buttons">
                <Button variant="primary" type="submit">
                  Save Palette
                </Button>
                <Button variant="quiet">
                  Cancel
                </Button>
              </div>
            </form>
          </template>
        </LibraryRow>
      </ul>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    width: 100%;
    border-top: var(--rule);
  }

  .headed {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .form {
    display: grid;
    gap: var(--space-4);
  }

  .buttons {
    display: flex;
    gap: var(--space-2) var(--space-4);
  }
}
</style>
