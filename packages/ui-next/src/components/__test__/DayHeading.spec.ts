import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import DayHeadingGallery from '../DayHeading.gallery.vue'
import DayHeading from '../DayHeading.vue'

const Log = defineComponent(() => () => h('ul', [
  h(DayHeading, () => 'Today'),
  h('li', '07:31 Rendered Calendar'),
  h(DayHeading, () => 'Friday 2 October'),
  h('li', '23:01 Sleep Mode began'),
]))

describe('day heading', () => {
  it('is an item of the list it stands in, among the lines of its day', async () => {
    const screen = await mount(Log)

    expect(screen.getByRole('list').getByRole('listitem').elements().map(item => item.textContent?.trim()))
      .toEqual(['Today', '07:31 Rendered Calendar', 'Friday 2 October', '23:01 Sleep Mode began'])
  })

  it('is set apart by its weight and a rule under it', async () => {
    const screen = await mount(Log)
    const heading = screen.getByText('Today').element()

    expect(getComputedStyle(heading).fontWeight).toBe('600')
    expect(getComputedStyle(heading).fontSize).toBe('13px')
    await expect.poll(() => getComputedStyle(heading).borderBottomWidth).toBe('1px')
  })

  it('is accessible and does not overflow', async () => {
    await mount(DayHeadingGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
