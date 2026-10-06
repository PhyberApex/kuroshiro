import { describe, expect, it } from 'vitest'
import { scrollSettled } from '../paint'

describe('scrollSettled', () => {
  it('resolves once an element stops scrolling', async () => {
    const el = document.createElement('div')
    el.style.cssText = 'width: 10px; overflow-x: scroll'
    el.innerHTML = '<div style="width: 100px; height: 1px"></div>'
    document.body.append(el)

    let stillScrolling = true
    const advance = (frame: number) => {
      if (frame >= 5) {
        stillScrolling = false
        return
      }
      el.scrollLeft = frame + 1
      requestAnimationFrame(() => advance(frame + 1))
    }
    advance(0)

    try {
      await scrollSettled()

      expect(stillScrolling).toBe(false)
      expect(el.scrollLeft).toBe(5)
    }
    finally {
      el.remove()
    }
  })

  it('resolves promptly when nothing is scrolling', async () => {
    await expect(scrollSettled()).resolves.toBeUndefined()
  })
})
