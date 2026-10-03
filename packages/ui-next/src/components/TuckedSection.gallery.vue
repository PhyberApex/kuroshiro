<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import TuckedSection from './TuckedSection.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="closed, hover, focus, open" wide>
      <div class="stretch">
        <TuckedSection title="Identity and credentials" heading="h3">
          <p class="lede">
            None of the three can be changed here.
          </p>
        </TuckedSection>
        <TuckedSection title="Special Functions" heading="h3" force="hover">
          <p class="lede">
            A one-shot command that reaches Kitchen at its next poll and fires once.
          </p>
        </TuckedSection>
        <TuckedSection title="Mirroring" heading="h3" force="focus">
          <p class="lede">
            Kitchen shows the image of a Device on TRMNL's own server instead of its own Screens.
          </p>
        </TuckedSection>
        <TuckedSection title="Reset or delete Kitchen" heading="h3" open>
          <p class="lede">
            A Device Reset makes Kitchen erase its Wi-Fi credentials and this server's URL at its next poll, so someone has to set it up by hand again. Nothing here is lost.
          </p>
          <div class="buttons">
            <Button>Device Reset</Button>
            <Button>Delete Kitchen</Button>
          </div>
        </TuckedSection>
      </div>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="Opened by the address">
    <Specimen caption="an address ending in #gallery-plugin-fields opens it" wide>
      <div class="stretch">
        <a href="#gallery-plugin-fields">Go to the Plugin Fields</a>
        <TuckedSection id="gallery-plugin-fields" class="below" title="Plugin Fields" heading="h3">
          <p class="lede">
            What Weather asks for wherever it is shown.
          </p>
        </TuckedSection>
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }

  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .below {
    margin-top: var(--space-3);
  }
}
</style>
