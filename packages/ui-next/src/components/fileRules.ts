const KILOBYTE = 1024
const MEGABYTE = 1024 * KILOBYTE

/** A size as the admin reads it: "640 KB", "10 MB", "12.4 MB". */
export function formatBytes(bytes: number) {
  const kilobytes = Math.max(1, Math.round(bytes / KILOBYTE))
  return kilobytes < KILOBYTE
    ? `${kilobytes} KB`
    : `${Number((bytes / MEGABYTE).toFixed(1))} MB`
}

/** `['.png', '.jpg']` read aloud: "PNG or JPG". */
export function formatNames(accept: string[]) {
  return new Intl.ListFormat('en-GB', { type: 'disjunction' }).format(accept.map(ending => ending.replace(/^\./, '').toUpperCase()))
}

/** The sentences of a place whose spec words them itself. One left out is worded here. */
export interface FileWording {
  /** The whole sentence that says what to drop, the types and the limit included: "Drop a .bin here, up to 8 MB." */
  prompt?: string
  wrongType?: string
  /** Handed the refused file's size as the admin reads it: "12.4 MB". */
  tooLarge?: (size: string) => string
}

export interface FileRules {
  /** The file name endings that are taken, each with its dot. */
  accept: string[]
  maxBytes: number
  /** The accepted types as the admin reads them. */
  formats: string
  wording?: FileWording
}

/** Why a file is refused, or nothing when it is taken. The type is read off the file's name: the type a browser reports depends on the machine. */
export function refusalOf(file: Pick<File, 'name' | 'size'>, { accept, maxBytes, formats, wording }: FileRules) {
  const name = file.name.toLowerCase()
  if (!accept.some(ending => name.endsWith(ending.toLowerCase())))
    return wording?.wrongType ?? `${file.name} is not a ${formats} file.`
  if (file.size > maxBytes)
    return wording?.tooLarge?.(formatBytes(file.size)) ?? `${file.name} is ${formatBytes(file.size)}. The largest file allowed is ${formatBytes(maxBytes)}.`
  return undefined
}
