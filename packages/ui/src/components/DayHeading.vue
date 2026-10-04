<template>
  <li class="day-heading">
    <slot />
  </li>
</template>

<style scoped>
@layer components {
  .day-heading {
    padding: var(--space-4) 0 var(--space-1);
    border-bottom: var(--rule);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }
}
</style>
