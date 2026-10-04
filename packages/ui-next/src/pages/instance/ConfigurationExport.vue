<script setup lang="ts">
import Icon from '@/components/Icon.vue'
import ArchiveExportRow from './ArchiveExportRow.vue'
import InstanceSection from './InstanceSection.vue'
</script>

<template>
  <InstanceSection id="export" title="Configuration Export">
    <ArchiveExportRow name="With its secrets" button="Export" primary>
      <p>The archive to restore from. Devices keep their API keys, so they go on polling a restored Instance without being set up again.</p>
      <p class="warning">
        <Icon name="problem" class="mark" />
        <span>Holds every Device API key, mirror API key, Webhook Token, Data Source header and password Field Value as written. Keep it like a password.</span>
      </p>
    </ArchiveExportRow>
    <ArchiveExportRow name="Redacted Archive" button="Export redacted" redacted>
      <p>The same with every secret replaced by a placeholder. Safe to share or to keep in a repository. Restored onto a fresh Instance, each Device and Webhook sender has to be set up again.</p>
    </ArchiveExportRow>
    <p class="not-in-either">
      Not in either: rendered images, Webhook Payloads, Sensor readings, Device Logs, Alerts, the files of custom Firmware and anything synced from TRMNL. A File Screen's image is included.
    </p>
  </InstanceSection>
</template>

<style scoped>
@layer components {
  /* A warning is ink, never red: it is told by its weight and the problem icon. */
  .warning {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-top: var(--space-1);
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .warning .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .not-in-either {
    max-width: var(--measure);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }
}
</style>
