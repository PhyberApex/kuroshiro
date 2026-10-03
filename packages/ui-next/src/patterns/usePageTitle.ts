import { watchEffect } from 'vue'

/** Names the browser tab after the page: "Kitchen · Kuroshiro". */
export function usePageTitle(title: () => string) {
  watchEffect(() => {
    document.title = `${title()} · Kuroshiro`
  })
}
