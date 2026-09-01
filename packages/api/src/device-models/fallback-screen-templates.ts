import type { FallbackScreenKind } from './fallback-screens.service.js'

/**
 * Bump whenever the markup below changes so cached renders regenerate. Baked
 * into the cache path in fallback-screens.service.ts rather than compared via
 * mtime, since the template lives in compiled JS with no source file to stat.
 */
export const FALLBACK_SCREEN_TEMPLATE_VERSION = 1

const CAPTIONS: Record<FallbackScreenKind, string> = {
  noScreen: 'Empty screen',
  error: 'Error',
  welcome: 'Setup in progress',
  sleep: 'Sleeping',
}

// Traced from the legacy public/screens/*.png artwork with potrace so the
// mark stays crisp at any model size instead of being raster-upscaled.
const ICON_SVG = `<svg viewBox="0 0 303.012687 238.034166" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(-2.490556,239.968341) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
<path d="M192 2381 c-31 -11 -70 -35 -94 -57 -79 -77 -73 10 -73 -1105 l0
-995 24 -48 c45 -86 98 -125 199 -145 84 -17 2518 -14 2598 3 73 15 126 46
157 89 55 76 52 11 52 1092 l0 1001 -25 49 c-30 59 -97 110 -163 125 -32 7
-478 10 -1335 10 -1223 -1 -1290 -2 -1340 -19z m2605 -89 c82 -9 118 -29 145
-83 16 -31 17 -110 18 -990 0 -1031 2 -997 -52 -1045 -12 -12 -33 -27 -45 -33
-16 -8 -379 -11 -1326 -11 l-1304 0 -34 23 c-19 12 -43 40 -54 62 -20 39 -20
60 -20 1000 0 901 1 962 18 995 26 52 61 73 136 80 90 10 2428 11 2518 2z"/>
<path d="M350 2140 c-19 -5 -45 -20 -57 -35 l-23 -26 0 -864 0 -865 29 -32 29
-33 606 -3 606 -3 0 936 0 935 -577 -1 c-318 -1 -594 -5 -613 -9z m930 -680
l0 -220 -155 0 -155 0 0 -35 0 -35 175 0 175 0 0 -50 0 -50 -175 0 -175 0 0
-25 0 -25 200 0 200 0 0 -50 0 -50 -466 0 -465 0 3 48 3 47 198 3 197 2 0 25
0 25 -175 0 -175 0 0 50 0 50 173 2 172 3 3 27 3 27 -163 3 -163 3 -3 203 c-1
128 1 210 8 222 10 19 23 20 385 20 l375 0 0 -220z m-36 -584 c14 -19 32 -40
39 -48 7 -7 22 -27 34 -44 20 -28 21 -33 7 -52 -17 -24 -74 -58 -74 -44 0 5
-27 44 -61 86 -34 42 -59 82 -56 89 4 12 62 46 78 47 4 0 18 -15 33 -34z
m-609 2 c19 -13 35 -25 35 -29 0 -3 -22 -32 -49 -66 -27 -33 -54 -70 -60 -82
l-12 -21 -39 26 c-21 14 -41 32 -44 40 -8 21 97 154 121 154 7 0 29 -10 48
-22z m422 -53 c31 -99 30 -113 -11 -120 -61 -12 -77 -4 -92 45 -8 25 -19 59
-24 76 -15 45 -13 54 13 54 12 0 29 5 37 10 35 23 54 7 77 -65z m-209 -37 l3
-88 -61 0 -60 0 0 90 0 91 58 -3 57 -3 3 -87z"/>
<path d="M640 1550 l0 -41 98 3 97 3 0 35 0 35 -97 3 -98 3 0 -41z"/>
<path d="M967 1584 c-4 -4 -7 -22 -7 -41 l0 -33 101 0 100 0 -3 38 -3 37 -90
3 c-50 1 -94 0 -98 -4z"/>
<path d="M640 1370 l0 -41 98 3 97 3 0 35 0 35 -97 3 -98 3 0 -41z"/>
<path d="M964 1395 c-3 -8 -3 -26 0 -40 6 -24 8 -25 102 -25 l95 0 -3 38 -3
37 -93 3 c-76 2 -93 0 -98 -13z"/>
<path d="M2133 1738 c-4 -7 -21 -40 -38 -73 -35 -71 -39 -72 -197 -74 l-108
-1 0 -445 0 -445 55 0 c50 0 55 2 61 25 l6 25 294 0 294 0 0 -25 c0 -24 3 -25
60 -25 l60 0 2 420 c1 231 2 428 2 437 1 9 -13 25 -30 35 -25 15 -37 16 -58 8
-37 -14 -326 -13 -326 0 0 6 9 28 20 50 30 58 27 67 -32 85 -62 18 -55 18 -65
3z m355 -280 c8 -8 12 -48 12 -115 l0 -103 -295 0 -295 0 0 108 c0 60 3 112 7
115 3 4 131 7 283 7 201 0 279 -3 288 -12z m12 -463 l0 -115 -285 0 c-157 0
-288 0 -292 0 -5 0 -9 52 -11 115 l-3 115 296 0 295 0 0 -115z"/>
</g>
</svg>`

/**
 * Body markup for a fallback screen: the kuroshiro mark plus a caption,
 * sized relative to the `.screen`/`.view--full` box (percentages, not
 * vw/vh) since plugins.css lays that box out in design pixels and scales it
 * with a CSS transform rather than the physical viewport.
 */
export function fallbackScreenBody(kind: FallbackScreenKind): string {
  return `<style>
  .fallback-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4%; width: 100%; height: 100%; background: #fff; box-sizing: border-box; }
  .fallback-screen svg { width: 40%; height: auto; }
  .fallback-screen span { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-weight: 700; font-size: calc(var(--screen-w, 100%) / 13); letter-spacing: 0.02em; color: #000; }
  </style>
  <div class="fallback-screen">
    ${ICON_SVG}
    <span>${CAPTIONS[kind]}</span>
  </div>`
}
