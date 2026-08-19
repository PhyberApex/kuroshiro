export function cacheBustedUrl(url: string, version: string | null | undefined) {
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}
