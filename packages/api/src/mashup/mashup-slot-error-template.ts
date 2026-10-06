import { FALLBACK_SCREEN_FONTS } from '../device-models/fallback-screen-fonts.js'

/**
 * The "problem" icon's ink square with its exclamation mark, on the same 16
 * px grid as packages/ui/src/components/icons.ts's `problem` path. Inlined
 * rather than imported: packages/api has no dependency edge to packages/ui.
 */
const PROBLEM_MARK = '<svg class="mashup-slot-error__mark" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M2 2h12v12H2zM7.2 4.5v4.6h1.6V4.5zM7.2 10.2v1.6h1.6v-1.6z"/></svg>'

const FONT_FACES = ([
  ['Kuroshiro Display', FALLBACK_SCREEN_FONTS.display],
  ['Kuroshiro Text', FALLBACK_SCREEN_FONTS.text],
] as const).map(([family, data]) => `@font-face { font-family: "${family}"; src: url(data:font/woff;base64,${data}) format("woff"); }`).join('\n')

/**
 * Shared across every failed slot in a Mashup so the base64 font faces are
 * embedded once per render, not once per failed slot.
 */
export const MASHUP_SLOT_ERROR_STYLE = `
${FONT_FACES}
.mashup-slot-error { container-type: size; width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 4cqw; padding: 0 6cqw; overflow: hidden; background: #fff; color: #000; }
.mashup-slot-error__mark { flex: none; width: 11cqh; height: 11cqh; fill: #000; }
.mashup-slot-error__text { min-width: 0; }
.mashup-slot-error__name { font-family: "Kuroshiro Display", sans-serif; font-size: 11cqh; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mashup-slot-error__line { font-family: "Kuroshiro Text", sans-serif; font-size: 5.5cqh; line-height: 1.3; }
`

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!)
}

/**
 * The drawing a Mashup slot shows in place of its Plugin, following
 * docs/ui/plugins.md's "On the Device: a Mashup slot whose Plugin could not
 * be rendered": paper ground, ink only, no seal, the problem mark then the
 * Plugin's name then the fixed wording, all sized from the slot itself via
 * container query units rather than the Screen's pixel size (TRMNL's
 * plugins.css, not this service, gives the slot its actual box).
 */
export function mashupSlotErrorHtml(pluginName: string): string {
  return `<div class="mashup-slot-error">${PROBLEM_MARK}<div class="mashup-slot-error__text"><div class="mashup-slot-error__name">${escapeHtml(pluginName)}</div><div class="mashup-slot-error__line">could not be shown.</div><div class="mashup-slot-error__line">Next try on its next turn in Rotation.</div></div></div>`
}
