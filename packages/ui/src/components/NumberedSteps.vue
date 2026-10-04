<template>
  <ol class="numbered-steps" role="list">
    <slot />
  </ol>
</template>

<style scoped>
@layer components {
  /* The numbers are drawn, not list markers, and Safari drops the semantics of a list without markers: hence `role="list"` on the `ol`. */
  .numbered-steps {
    --number-column: calc(1.5rem + var(--space-3));

    max-width: 45rem;
    counter-reset: step;
  }

  .numbered-steps > :slotted(li) {
    position: relative;
    padding: var(--space-3) 0 var(--space-3) var(--number-column);
    border-bottom: var(--rule);
    counter-increment: step;
  }

  .numbered-steps > :slotted(li:first-child) {
    border-top: var(--rule);
  }

  .numbered-steps > :slotted(li)::before {
    content: counter(step);
    position: absolute;
    left: 0;
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: calc(var(--leading-text) * var(--text-md));
  }
}
</style>
