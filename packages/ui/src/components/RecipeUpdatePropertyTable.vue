<script setup lang="ts">
defineProps<{
  rows: Array<{ label: string, before: unknown, after: unknown }>
}>()

function formatValue(value: unknown): string {
  if (value === undefined || value === null)
    return ''
  if (typeof value === 'object')
    return JSON.stringify(value)
  return String(value)
}
</script>

<template>
  <table v-if="rows.length" class="w-100">
    <tbody>
      <tr v-for="row in rows" :key="row.label">
        <td class="text-medium-emphasis pr-4">
          {{ row.label }}
        </td>
        <td class="pr-4">
          {{ formatValue(row.before) }}
        </td>
        <td>
          {{ formatValue(row.after) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
