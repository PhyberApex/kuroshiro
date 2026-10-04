const UNSAFE_IN_A_FILE_NAME = /["\\/:*?<>|\p{Cc}]/gu
const OUTSIDE_ASCII = /\P{ASCII}/gu
const UNESCAPED_BY_ENCODE_URI_COMPONENT = /['()*]/g

function percentEncoded(character: string): string {
  return `%${character.charCodeAt(0).toString(16).toUpperCase()}`
}

/**
 * The `Content-Disposition` of a download named `filename`, whatever the name holds (RFC 6266):
 * an ASCII `filename` for a client that reads nothing else, and the name itself as `filename*`.
 * A character no file name may hold is replaced by `_` in both.
 */
export function attachmentDisposition(filename: string): string {
  const safe = filename.replace(UNSAFE_IN_A_FILE_NAME, '_')
  const ascii = safe.replace(OUTSIDE_ASCII, '_')
  const encoded = encodeURIComponent(safe).replace(UNESCAPED_BY_ENCODE_URI_COMPONENT, percentEncoded)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
