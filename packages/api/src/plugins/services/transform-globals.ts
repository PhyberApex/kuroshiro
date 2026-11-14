/**
 * The web globals a transform sees, as source evaluated inside its sandbox (ADR-0077). ADR-0055 lent the server's own
 * objects; each of those is a reference back to the host's heap, so the same surface is built inside the sandbox
 * instead. What cannot be built there — the clock, the entropy and the network — is bridged in as a plain function.
 *
 * This module holds no imports on purpose: the worker beside it runs as raw `.ts` under test, where only Node's own
 * resolver is in play.
 */

/** Base64, UTF-8 and the structured clone, none of which an engine provides. */
const CODECS = `
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

globalThis.btoa = (input) => {
  const text = String(input)
  let out = ''
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i), b = text.charCodeAt(i + 1), c = text.charCodeAt(i + 2)
    if (a > 255 || b > 255 || c > 255) throw new Error('btoa: the string holds a character above U+00FF')
    const triplet = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c)
    out += B64[(triplet >> 18) & 63] + B64[(triplet >> 12) & 63]
    out += Number.isNaN(b) ? '=' : B64[(triplet >> 6) & 63]
    out += Number.isNaN(c) ? '=' : B64[triplet & 63]
  }
  return out
}

globalThis.atob = (input) => {
  const text = String(input).replace(/[\\t\\n\\f\\r ]/g, '').replace(/=+$/, '')
  if (text.length % 4 === 1) throw new Error('atob: the string is not valid base64')
  let bits = 0, held = 0, out = ''
  for (const char of text) {
    const value = B64.indexOf(char)
    if (value < 0) throw new Error('atob: the string is not valid base64')
    held = (held << 6) | value
    bits += 6
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((held >> bits) & 255) }
  }
  return out
}

globalThis.TextEncoder = class TextEncoder {
  get encoding() { return 'utf-8' }
  encode(input = '') {
    const text = String(input)
    const bytes = []
    for (let i = 0; i < text.length; i++) {
      let point = text.codePointAt(i)
      if (point > 0xFFFF) i++
      if (point < 0x80) bytes.push(point)
      else if (point < 0x800) bytes.push(0xC0 | (point >> 6), 0x80 | (point & 63))
      else if (point < 0x10000) bytes.push(0xE0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63))
      else bytes.push(0xF0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63))
    }
    return new Uint8Array(bytes)
  }
}

globalThis.TextDecoder = class TextDecoder {
  constructor(encoding = 'utf-8') {
    const name = String(encoding).toLowerCase()
    if (name !== 'utf-8' && name !== 'utf8') throw new RangeError('TextDecoder: only utf-8 is supported here')
  }
  get encoding() { return 'utf-8' }
  decode(input) {
    if (input === undefined) return ''
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input.buffer ?? input)
    let out = ''
    for (let i = 0; i < bytes.length;) {
      const byte = bytes[i]
      let point, width
      if (byte < 0x80) { point = byte; width = 1 }
      else if ((byte & 0xE0) === 0xC0) { point = byte & 31; width = 2 }
      else if ((byte & 0xF0) === 0xE0) { point = byte & 15; width = 3 }
      else if ((byte & 0xF8) === 0xF0) { point = byte & 7; width = 4 }
      else { out += '\\uFFFD'; i++; continue }
      if (i + width > bytes.length) { out += '\\uFFFD'; break }
      for (let k = 1; k < width; k++) {
        const next = bytes[i + k]
        if ((next & 0xC0) !== 0x80) { point = -1; break }
        point = (point << 6) | (next & 63)
      }
      i += width
      out += point < 0 ? '\\uFFFD' : String.fromCodePoint(point)
    }
    return out
  }
}

globalThis.structuredClone = (value) => {
  const seen = new Map()
  const walk = (item) => {
    if (item === null || typeof item !== 'object') {
      if (typeof item === 'function' || typeof item === 'symbol') throw new Error('structuredClone: this value cannot be cloned')
      return item
    }
    if (seen.has(item)) return seen.get(item)
    if (item instanceof Date) return new Date(item.getTime())
    if (item instanceof RegExp) return new RegExp(item.source, item.flags)
    if (item instanceof ArrayBuffer) return item.slice(0)
    if (ArrayBuffer.isView(item)) return new item.constructor(walk(item.buffer), item.byteOffset, item.length)
    if (item instanceof Map) {
      const copy = new Map(); seen.set(item, copy)
      for (const [k, v] of item) copy.set(walk(k), walk(v))
      return copy
    }
    if (item instanceof Set) {
      const copy = new Set(); seen.set(item, copy)
      for (const v of item) copy.add(walk(v))
      return copy
    }
    if (Array.isArray(item)) {
      const copy = []; seen.set(item, copy)
      for (const v of item) copy.push(walk(v))
      return copy
    }
    const copy = {}; seen.set(item, copy)
    for (const key of Object.keys(item)) copy[key] = walk(item[key])
    return copy
  }
  return walk(value)
}
`

/** The abort pair, which a transform uses to bound its own `fetch` (ADR-0055's reason for lending them at all). */
const ABORT = `
globalThis.AbortSignal = class AbortSignal {
  constructor() { this.aborted = false; this.reason = undefined; this.onabort = null; this.__listeners = [] }
  addEventListener(type, listener) { if (type === 'abort' && listener) this.__listeners.push(listener) }
  removeEventListener(type, listener) {
    if (type !== 'abort') return
    const at = this.__listeners.indexOf(listener)
    if (at >= 0) this.__listeners.splice(at, 1)
  }
  throwIfAborted() { if (this.aborted) throw this.reason }
  __fire(reason) {
    if (this.aborted) return
    this.aborted = true
    this.reason = reason
    const event = { type: 'abort', target: this }
    if (typeof this.onabort === 'function') this.onabort(event)
    for (const listener of this.__listeners.slice()) {
      if (typeof listener === 'function') listener(event)
      else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(event)
    }
  }
  static abort(reason) {
    const signal = new AbortSignal()
    signal.__fire(reason === undefined ? new Error('This operation was aborted') : reason)
    return signal
  }
  static timeout(ms) {
    const signal = new AbortSignal()
    const error = new Error('The operation was aborted due to timeout')
    error.name = 'TimeoutError'
    setTimeout(() => signal.__fire(error), ms)
    return signal
  }
}

globalThis.AbortController = class AbortController {
  constructor() { this.signal = new AbortSignal() }
  abort(reason) {
    if (reason === undefined) {
      reason = new Error('This operation was aborted')
      reason.name = 'AbortError'
    }
    this.signal.__fire(reason)
  }
}
`

/**
 * `URL` and `URLSearchParams`. The parse covers an absolute web address and a reference resolved against one, which
 * is what a transform builds a request with; it is not the whole WHATWG state machine — no IDN, and a non-web scheme
 * is kept opaque rather than given a host.
 */
const URLS = `
const encodeQueryPart = (text) => encodeURIComponent(String(text)).replace(/%20/g, '+').replace(/[!'()~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

globalThis.URLSearchParams = class URLSearchParams {
  constructor(init) {
    this.__pairs = []
    if (init === undefined || init === null || init === '') return
    if (typeof init === 'string') {
      for (const part of init.replace(/^\\?/, '').split('&')) {
        if (part === '') continue
        const at = part.indexOf('=')
        const rawName = at < 0 ? part : part.slice(0, at)
        const rawValue = at < 0 ? '' : part.slice(at + 1)
        this.__pairs.push([decodeURIComponent(rawName.replace(/\\+/g, ' ')), decodeURIComponent(rawValue.replace(/\\+/g, ' '))])
      }
      return
    }
    if (init instanceof URLSearchParams) { this.__pairs = init.__pairs.map((pair) => pair.slice()); return }
    if (Array.isArray(init)) { for (const [name, value] of init) this.__pairs.push([String(name), String(value)]); return }
    if (typeof init[Symbol.iterator] === 'function') { for (const [name, value] of init) this.__pairs.push([String(name), String(value)]); return }
    for (const key of Object.keys(init)) this.__pairs.push([key, String(init[key])])
  }
  append(name, value) { this.__pairs.push([String(name), String(value)]); this.__onchange() }
  delete(name) { const key = String(name); this.__pairs = this.__pairs.filter((pair) => pair[0] !== key); this.__onchange() }
  get(name) { const key = String(name); const found = this.__pairs.find((pair) => pair[0] === key); return found ? found[1] : null }
  getAll(name) { const key = String(name); return this.__pairs.filter((pair) => pair[0] === key).map((pair) => pair[1]) }
  has(name) { const key = String(name); return this.__pairs.some((pair) => pair[0] === key) }
  set(name, value) {
    const key = String(name)
    const at = this.__pairs.findIndex((pair) => pair[0] === key)
    if (at < 0) this.__pairs.push([key, String(value)])
    else { this.__pairs[at] = [key, String(value)]; this.__pairs = this.__pairs.filter((pair, index) => index <= at || pair[0] !== key) }
    this.__onchange()
  }
  sort() { this.__pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)); this.__onchange() }
  forEach(callback, thisArg) { for (const [name, value] of this.__pairs.slice()) callback.call(thisArg, value, name, this) }
  keys() { return this.__pairs.map((pair) => pair[0])[Symbol.iterator]() }
  values() { return this.__pairs.map((pair) => pair[1])[Symbol.iterator]() }
  entries() { return this.__pairs.map((pair) => pair.slice())[Symbol.iterator]() }
  [Symbol.iterator]() { return this.entries() }
  get size() { return this.__pairs.length }
  toString() { return this.__pairs.map(([name, value]) => encodeQueryPart(name) + '=' + encodeQueryPart(value)).join('&') }
  __onchange() { if (this.__url) this.__url.__setSearchFromParams(this.toString()) }
}

const SPECIAL_PORTS = { 'http:': '80', 'https:': '443', 'ws:': '80', 'wss:': '443', 'ftp:': '21' }
const ABSOLUTE = /^([A-Za-z][A-Za-z0-9+.-]*:)(\\/\\/)?([^?#]*)(\\?[^#]*)?(#.*)?$/

const normalisePath = (path) => {
  const parts = path.split('/')
  const out = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') { out.pop(); continue }
    out.push(part)
  }
  let joined = out.join('/')
  if (!joined.startsWith('/')) joined = '/' + joined
  return joined
}

globalThis.URL = class URL {
  constructor(input, base) {
    const text = String(input).trim()
    let match = ABSOLUTE.exec(text)
    if (!match && base === undefined) throw new TypeError('Invalid URL: ' + text)
    if (!match) {
      const parent = base instanceof URL ? parent__href(base) : String(base)
      const root = ABSOLUTE.exec(parent.trim())
      if (!root) throw new TypeError('Invalid base URL: ' + parent)
      match = resolveAgainst(root, text)
    }
    this.__parse(match)
  }
  __parse(match) {
    const [, scheme, slashes, authorityAndPath, query, fragment] = match
    this.protocol = scheme.toLowerCase()
    this.username = ''
    this.password = ''
    this.__opaque = !slashes
    if (this.__opaque) {
      this.host = ''
      this.hostname = ''
      this.port = ''
      this.pathname = authorityAndPath
    }
    else {
      const slash = authorityAndPath.indexOf('/')
      let authority = slash < 0 ? authorityAndPath : authorityAndPath.slice(0, slash)
      const path = slash < 0 ? '' : authorityAndPath.slice(slash)
      const at = authority.lastIndexOf('@')
      if (at >= 0) {
        const credentials = authority.slice(0, at)
        authority = authority.slice(at + 1)
        const colon = credentials.indexOf(':')
        this.username = colon < 0 ? credentials : credentials.slice(0, colon)
        this.password = colon < 0 ? '' : credentials.slice(colon + 1)
      }
      let host = authority, port = ''
      const bracket = authority.lastIndexOf(']')
      const colon = authority.indexOf(':', bracket < 0 ? 0 : bracket)
      if (colon >= 0) { host = authority.slice(0, colon); port = authority.slice(colon + 1) }
      if (port !== '' && !/^[0-9]+$/.test(port)) throw new TypeError('Invalid URL: the port is not a number')
      this.hostname = host.toLowerCase()
      this.port = SPECIAL_PORTS[this.protocol] === port ? '' : port
      this.host = this.hostname + (this.port === '' ? '' : ':' + this.port)
      this.pathname = normalisePath(path === '' ? '/' : path)
    }
    this.hash = fragment === undefined || fragment === '#' ? '' : fragment
    const search = query === undefined || query === '?' ? '' : query
    this.searchParams = new URLSearchParams(search)
    this.searchParams.__url = this
    this.search = search
  }
  __setSearchFromParams(text) { this.search = text === '' ? '' : '?' + text }
  get origin() { return this.__opaque ? 'null' : this.protocol + '//' + this.host }
  get href() { return parent__href(this) }
  set href(value) { this.__parse(ABSOLUTE.exec(String(value)) ?? (() => { throw new TypeError('Invalid URL: ' + value) })()) }
  toString() { return this.href }
  toJSON() { return this.href }
}

function parent__href(url) {
  const credentials = url.username === '' ? '' : url.username + (url.password === '' ? '' : ':' + url.password) + '@'
  const authority = url.__opaque ? '' : '//' + credentials + url.host
  return url.protocol + authority + url.pathname + url.search + url.hash
}

function resolveAgainst(root, reference) {
  const base = new URL(root[1] + (root[2] ?? '') + root[3] + (root[4] ?? '') + (root[5] ?? ''))
  if (reference.startsWith('//')) return ABSOLUTE.exec(base.protocol + reference)
  if (reference.startsWith('#')) return ABSOLUTE.exec(base.protocol + '//' + base.host + base.pathname + base.search + reference)
  if (reference.startsWith('?')) return ABSOLUTE.exec(base.protocol + '//' + base.host + base.pathname + reference)
  const cut = reference.indexOf('#')
  const fragment = cut < 0 ? '' : reference.slice(cut)
  const withoutFragment = cut < 0 ? reference : reference.slice(0, cut)
  const split = withoutFragment.indexOf('?')
  const query = split < 0 ? '' : withoutFragment.slice(split)
  const path = split < 0 ? withoutFragment : withoutFragment.slice(0, split)
  const absolute = path.startsWith('/') ? path : base.pathname.replace(/[^/]*$/, '') + path
  return ABSOLUTE.exec(base.protocol + '//' + base.host + normalisePath(absolute) + query + fragment)
}
`

/**
 * `Headers`, `Request`, `Response` and the `fetch` built on them. The sandbox's `fetch` serialises the request itself
 * and wraps what comes back in its own `Response`, so the thread hands it plain data and no host object crosses in.
 */
const HTTP = `
const FORBIDDEN_BODY_STATUSES = new Set([101, 103, 204, 205, 304])

globalThis.Headers = class Headers {
  constructor(init) {
    this.__pairs = []
    if (!init) return
    if (init instanceof Headers) { this.__pairs = init.__pairs.map((pair) => pair.slice()); return }
    if (Array.isArray(init)) { for (const [name, value] of init) this.append(name, value); return }
    for (const key of Object.keys(init)) this.append(key, init[key])
  }
  append(name, value) { this.__pairs.push([String(name).toLowerCase(), String(value).trim()]) }
  delete(name) { const key = String(name).toLowerCase(); this.__pairs = this.__pairs.filter((pair) => pair[0] !== key) }
  get(name) {
    const key = String(name).toLowerCase()
    const found = this.__pairs.filter((pair) => pair[0] === key)
    return found.length === 0 ? null : found.map((pair) => pair[1]).join(', ')
  }
  getSetCookie() { return this.__pairs.filter((pair) => pair[0] === 'set-cookie').map((pair) => pair[1]) }
  has(name) { const key = String(name).toLowerCase(); return this.__pairs.some((pair) => pair[0] === key) }
  set(name, value) { this.delete(name); this.append(name, value) }
  forEach(callback, thisArg) { for (const [name, value] of this.entries()) callback.call(thisArg, value, name, this) }
  keys() { return [...this.entries()].map((pair) => pair[0])[Symbol.iterator]() }
  values() { return [...this.entries()].map((pair) => pair[1])[Symbol.iterator]() }
  entries() {
    const names = [...new Set(this.__pairs.map((pair) => pair[0]))].sort()
    return names.map((name) => [name, this.get(name)])[Symbol.iterator]()
  }
  [Symbol.iterator]() { return this.entries() }
}

const bodyInit = (body) => {
  if (body === undefined || body === null) return { bytes: undefined, contentType: undefined }
  if (typeof body === 'string') return { bytes: new TextEncoder().encode(body), contentType: 'text/plain;charset=UTF-8' }
  if (body instanceof URLSearchParams) return { bytes: new TextEncoder().encode(body.toString()), contentType: 'application/x-www-form-urlencoded;charset=UTF-8' }
  if (body instanceof ArrayBuffer) return { bytes: new Uint8Array(body.slice(0)), contentType: undefined }
  if (ArrayBuffer.isView(body)) return { bytes: new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)), contentType: undefined }
  return { bytes: new TextEncoder().encode(JSON.stringify(body)), contentType: 'application/json' }
}

class Body {
  constructor(bytes) { this.__bytes = bytes; this.bodyUsed = false }
  get body() { return this.__bytes === undefined ? null : this.__bytes }
  async arrayBuffer() {
    if (this.bodyUsed) throw new TypeError('The body has already been read')
    this.bodyUsed = true
    const bytes = this.__bytes ?? new Uint8Array(0)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  async bytes() { return new Uint8Array(await this.arrayBuffer()) }
  async text() { return new TextDecoder().decode(new Uint8Array(await this.arrayBuffer())) }
  async json() { return JSON.parse(await this.text()) }
}

globalThis.Request = class Request extends Body {
  constructor(input, init = {}) {
    const from = input instanceof Request ? input : null
    const url = from ? from.url : new URL(String(input)).href
    const chosen = init.body !== undefined && init.body !== null ? bodyInit(init.body) : { bytes: from ? from.__bytes : undefined, contentType: undefined }
    super(chosen.bytes)
    this.url = url
    this.method = String(init.method ?? (from ? from.method : 'GET')).toUpperCase()
    this.headers = new Headers(init.headers ?? (from ? from.headers : undefined))
    if (chosen.contentType !== undefined && !this.headers.has('content-type')) this.headers.set('content-type', chosen.contentType)
    this.redirect = init.redirect ?? (from ? from.redirect : 'follow')
    this.signal = init.signal ?? (from ? from.signal : undefined)
    if ((this.method === 'GET' || this.method === 'HEAD') && chosen.bytes !== undefined) throw new TypeError('A GET or HEAD request cannot have a body')
  }
  clone() { return new Request(this, { body: this.__bytes }) }
}

globalThis.Response = class Response extends Body {
  constructor(body, init = {}) {
    const status = init.status === undefined ? 200 : Number(init.status)
    const chosen = FORBIDDEN_BODY_STATUSES.has(status) ? { bytes: undefined, contentType: undefined } : bodyInit(body)
    super(chosen.bytes)
    this.status = status
    this.statusText = String(init.statusText ?? '')
    this.headers = new Headers(init.headers)
    if (chosen.contentType !== undefined && !this.headers.has('content-type')) this.headers.set('content-type', chosen.contentType)
    this.url = init.url === undefined ? '' : String(init.url)
    this.redirected = false
    this.type = 'basic'
  }
  get ok() { return this.status >= 200 && this.status < 300 }
  clone() { return new Response(this.__bytes, { status: this.status, statusText: this.statusText, headers: this.headers, url: this.url }) }
  static json(data, init) {
    const response = new Response(JSON.stringify(data), init)
    response.headers.set('content-type', 'application/json')
    return response
  }
}

const bytesToBase64 = (bytes) => {
  let latin1 = ''
  for (let i = 0; i < bytes.length; i += 0x8000) latin1 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(latin1)
}

const base64ToBytes = (text) => {
  const latin1 = atob(text)
  const bytes = new Uint8Array(latin1.length)
  for (let i = 0; i < latin1.length; i++) bytes[i] = latin1.charCodeAt(i)
  return bytes
}

// Left undefined when the server lends no fetch, so a transform naming it fails as it would on any runtime without one.
if (typeof __fetchStart === 'function') globalThis.fetch = async (input, init = {}) => {
  const request = input instanceof Request && init.body === undefined ? input : new Request(input, init)
  const signal = request.signal
  if (signal && signal.aborted) throw signal.reason
  const headers = {}
  for (const [name, value] of request.headers.entries()) headers[name] = value
  const bytes = request.__bytes
  const id = __fetchStart({
    url: request.url,
    init: {
      method: request.method,
      headers,
      redirect: request.redirect,
      body: bytes === undefined ? undefined : bytesToBase64(bytes),
    },
  })
  const answer = await new Promise((resolve, reject) => {
    if (signal) signal.addEventListener('abort', () => { __fetchAbort(id); reject(signal.reason) })
    __fetchWait(id).then(resolve, reject)
  })
  if (answer.failed) {
    const error = new Error(answer.message)
    error.name = answer.name
    throw error
  }
  return new Response(FORBIDDEN_BODY_STATUSES.has(answer.status) ? null : base64ToBytes(answer.body), {
    status: answer.status,
    statusText: answer.statusText,
    headers: answer.headers,
    url: answer.url,
  })
}
`

/**
 * Every global a transform has, as one script. `__fetch`, `__log`, the timers, `performance` and `crypto` are bridged
 * in by the worker as plain functions; everything else is built here.
 */
export const SANDBOX_GLOBALS = [CODECS, ABORT, URLS, HTTP].join('\n')
