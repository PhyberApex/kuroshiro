<script setup lang="ts">
import { sections } from './sections'
</script>

<template>
  <main class="gallery">
    <h1 class="title">
      Gallery
    </h1>
    <p class="lede">
      Every primitive of the admin UI in every state. Served in development only.
    </p>

    <nav class="contents" aria-label="Sections">
      <ul>
        <li v-for="section in sections" :key="section.id">
          <a :href="`#${section.id}`">{{ section.title }}</a>
        </li>
      </ul>
    </nav>

    <section
      v-for="section in sections"
      :id="section.id"
      :key="section.id"
      class="section"
      :aria-labelledby="`${section.id}-title`"
    >
      <h2 :id="`${section.id}-title`" class="section-title">
        {{ section.title }}
      </h2>
      <component :is="section.component" />
    </section>
  </main>
</template>

<style scoped>
@layer components {
  .gallery {
    max-width: calc(var(--column) + 2 * var(--gutter));
    margin-inline: auto;
    padding: var(--space-12) var(--gutter) var(--space-16);
  }

  .title {
    font-stretch: var(--width-title-lg);
    font-weight: var(--weight-title-lg);
    font-size: var(--title-lg);
    line-height: var(--leading-title-lg);
    letter-spacing: var(--tracking-title-lg);
  }

  .lede {
    max-width: var(--measure);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
  }

  .contents ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-5);
    margin-top: var(--space-6);
  }

  .contents a {
    display: inline-block;
    padding-block: var(--space-1);
    font-weight: var(--weight-medium);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .contents a:hover {
    color: var(--color-ink-hover);
  }

  .section {
    margin-top: var(--space-12);
    padding: var(--space-5) 0 var(--space-2);
    border-top: var(--rule-heavy);
    background: var(--color-paper);
    scroll-margin-top: var(--space-4);
  }

  /* A component draws its hover and active states under `data-force` itself; the focus ring is the page's, so it is forced here. */
  .section :deep([data-force~='focus']) {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }

  .section-title {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-md);
    line-height: var(--leading-title);
  }
}
</style>
