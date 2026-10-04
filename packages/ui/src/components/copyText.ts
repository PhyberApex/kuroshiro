function copyThroughSelection(text: string) {
  const focused = document.activeElement
  const holder = document.createElement('textarea')
  holder.value = text
  holder.readOnly = true
  holder.style.position = 'fixed'
  holder.style.opacity = '0'
  document.body.append(holder)
  holder.select()
  const copied = document.execCommand('copy')
  holder.remove()
  if (focused instanceof HTMLElement)
    focused.focus()
  return copied
}

/**
 * Resolves to whether the text reached the clipboard. `navigator.clipboard` only exists
 * on HTTPS and on localhost, and an Instance on a home network is often plain HTTP, so
 * there the text is copied the old way, through a selection.
 */
export async function copyText(text: string) {
  if (!navigator.clipboard)
    return copyThroughSelection(text)
  return navigator.clipboard.writeText(text).then(() => true, () => copyThroughSelection(text))
}
