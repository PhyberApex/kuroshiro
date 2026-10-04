import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import FileDropGallery from '../FileDrop.gallery.vue'
import FileDrop from '../FileDrop.vue'

const MEGABYTE = 1024 * 1024
const IMAGES = { prompt: 'Drop an image here.', accept: ['.png', '.jpg'], formats: 'PNG or JPEG', maxBytes: 2 * MEGABYTE }

function fileOf(name: string, bytes = 1024) {
  return new File([new Uint8Array(bytes)], name)
}

function drop(target: Element, type: 'dragenter' | 'dragleave' | 'drop', files: File[] = []) {
  const dataTransfer = new DataTransfer()
  files.forEach(file => dataTransfer.items.add(file))
  target.dispatchEvent(new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true }))
}

async function mountDrop(props: object = {}) {
  const onUpdate = vi.fn()
  const screen = await mount(FileDrop, { props: { ...IMAGES, 'onUpdate:modelValue': onUpdate, ...props } })
  return { screen, onUpdate, input: screen.getByLabelText('Choose file') }
}

describe('file drop', () => {
  it('is a native file input whose text names the accepted types and the size limit', async () => {
    const { screen, input } = await mountDrop()

    await expect.element(input).toHaveAttribute('type', 'file')
    await expect.element(input).toHaveAttribute('accept', '.png,.jpg')
    await expect.element(screen.getByText('Drop an image here. PNG or JPEG, up to 2 MB.')).toBeVisible()
    await expect.element(input).toHaveAccessibleDescription('Drop an image here. PNG or JPEG, up to 2 MB.')
  })

  it('reads the types off the accepted endings when it is not told how they read', async () => {
    const { screen } = await mountDrop({ prompt: undefined, accept: ['.zip'], formats: undefined })

    await expect.element(screen.getByText('Drop a file here. ZIP, up to 2 MB.')).toBeVisible()
  })

  it('says a whole sentence of its place\'s own instead, when it is given one', async () => {
    const { screen, input } = await mountDrop({ accept: ['.bin'], wording: { prompt: 'Drop a .bin here, up to 8 MB.' } })

    await expect.element(screen.getByText('Drop a .bin here, up to 8 MB.', { exact: true })).toBeVisible()
    await expect.element(input).toHaveAccessibleDescription('Drop a .bin here, up to 8 MB.')
  })

  it('emits a file chosen by a click: "Choose file" is the input\'s label, so the click opens the browser\'s picker', async () => {
    const { screen, onUpdate, input } = await mountDrop()
    const file = fileOf('kitchen.png')
    expect(screen.getByText('Choose file').element()).toHaveAttribute('for', input.element().id)

    await userEvent.upload(input, file)

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(file)
  })

  it('is reached with Tab, where Enter and Space open the browser\'s picker, and emits the file chosen there', async () => {
    const { onUpdate, input } = await mountDrop()
    const file = fileOf('kitchen.jpg')

    await userEvent.keyboard('{Tab}')
    await expect.element(input).toHaveFocus()
    await userEvent.upload(input, file)

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(file)
  })

  it('shows its focus on "Choose file", because the input itself is out of sight', async () => {
    const { screen } = await mountDrop()

    await userEvent.keyboard('{Tab}')

    await expect.element(screen.getByText('Choose file')).toHaveStyle({ outlineStyle: 'solid', outlineWidth: '2px' })
  })

  it('emits a dropped file', async () => {
    const { screen, onUpdate } = await mountDrop()
    const file = fileOf('kitchen.png')

    drop(screen.getByText(/Drop an image here/).element(), 'drop', [file])

    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(file)
  })

  it('says so while a file is dragged over it, and stops when the file leaves', async () => {
    const { screen } = await mountDrop()
    const text = screen.getByText(/Drop an image here/).element()

    drop(text, 'dragenter')
    await expect.element(screen.getByText('Let go to choose this file.')).toBeVisible()

    drop(screen.getByText('Let go to choose this file.').element().parentElement!, 'dragleave')
    await expect.element(screen.getByText(/Drop an image here/)).toBeVisible()
  })

  it('shows the chosen file\'s name and size in place of its sentence', async () => {
    const { screen } = await mountDrop({ modelValue: fileOf('kitchen.png', 640 * 1024) })

    await expect.element(screen.getByText('kitchen.png')).toBeVisible()
    await expect.element(screen.getByText('640 KB')).toBeVisible()
    await expect.element(screen.getByText(/Drop an image here/)).not.toBeInTheDocument()
  })

  it.for(['chosen', 'dropped'] as const)('emits nothing for a %s file of another type and says why', async (how) => {
    const { screen, onUpdate, input } = await mountDrop()
    const file = fileOf('notes.txt')

    if (how === 'chosen')
      await userEvent.upload(input, file)
    else
      drop(screen.getByText(/Drop an image here/).element(), 'drop', [file])

    await expect.element(screen.getByText('notes.txt is not a PNG or JPEG file.')).toBeVisible()
    expect(onUpdate).not.toHaveBeenCalled()
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveAccessibleDescription(/notes\.txt is not a PNG or JPEG file\./)
  })

  it('emits nothing for a file over the limit and says its size and the limit', async () => {
    const { screen, onUpdate, input } = await mountDrop()

    await userEvent.upload(input, fileOf('kitchen.png', 3 * MEGABYTE))

    await expect.element(screen.getByText('kitchen.png is 3 MB. The largest file allowed is 2 MB.')).toBeVisible()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('announces a refusal in a live region and drops it once a file is taken', async () => {
    const { screen, onUpdate, input } = await mountDrop()
    const liveRegion = screen.container.querySelector<HTMLElement>('[aria-live="polite"]')!
    expect(liveRegion).toBeEmptyDOMElement()

    await userEvent.upload(input, fileOf('notes.txt'))
    await expect.element(liveRegion).toHaveTextContent('notes.txt is not a PNG or JPEG file.')

    const file = fileOf('kitchen.png')
    await userEvent.upload(input, file)
    await expect.element(liveRegion).toBeEmptyDOMElement()
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(file)
    await expect.element(input).not.toHaveAttribute('aria-invalid')
  })

  it('takes the same file again after it was refused or chosen', async () => {
    const { onUpdate, input } = await mountDrop()
    const file = fileOf('kitchen.png')

    await userEvent.upload(input, file)
    await userEvent.upload(input, file)

    expect(onUpdate).toHaveBeenCalledTimes(2)
  })

  it('takes nothing while disabled', async () => {
    const { screen, onUpdate, input } = await mountDrop({ disabled: true })

    await expect.element(input).toBeDisabled()
    drop(screen.getByText(/Drop an image here/).element(), 'dragenter')
    drop(screen.getByText(/Drop an image here/).element(), 'drop', [fileOf('kitchen.png')])

    expect(onUpdate).not.toHaveBeenCalled()
    await expect.element(screen.getByText(/Drop an image here/)).toBeVisible()
  })

  it('forwards its id and its description to the input, and marks an invalid file', async () => {
    const screen = await mount(FileDrop, {
      props: { ...IMAGES, invalid: true },
      attrs: { 'id': 'plugin-file', 'aria-describedby': 'plugin-file-error' },
    })
    const input = screen.getByLabelText('Choose file')

    await expect.element(input).toHaveAttribute('id', 'plugin-file')
    expect(input.element().getAttribute('aria-describedby')).toContain('plugin-file-error')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(FileDropGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
