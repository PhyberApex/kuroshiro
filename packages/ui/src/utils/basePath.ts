/**
 * The path Kuroshiro is served under, derived from `document.baseURI` at
 * runtime rather than Vite's build-time `base`. This lets one built image
 * work both at `/` and under a reverse-proxy prefix that's only known once
 * the page loads (e.g. Home Assistant's per-session ingress token), as long
 * as the server injects a matching `<base href>` into `index.html`.
 */
export function getBasePath(): string {
  return new URL(document.baseURI).pathname.replace(/\/+$/, '')
}

/**
 * Prefixes an absolute-path URL (one starting with `/`) with the runtime
 * base path. Non-absolute-path input (relative paths, full URLs) is
 * returned unchanged.
 */
export function withBasePath(path: string): string {
  return path.startsWith('/') ? `${getBasePath()}${path}` : path
}
