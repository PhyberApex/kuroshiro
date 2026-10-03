"""Writes graphics/logo-light.svg and graphics/logo-dark.svg: the Hanko seal beside the
"Kuroshiro" wordmark, with the wordmark outlined so no font is needed where it renders.

Usage: python3 graphics/build-logo.py path/to/archivo-latin-wdth-normal.woff2
The font is @fontsource-variable/archivo (needs fontTools and brotli).
"""
import re
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent
SEAL_SOURCE = ROOT.parent / "packages/ui-next/src/App.vue"
WORDMARK = "Kuroshiro"
WEIGHT, WIDTH = 800, 68
FONT_SIZE = 44
TRACKING_EM = -0.015
SEAL_SIZE = 64
GAP = 14
THEMES = {
    "light": {"seal": "#c4242f", "ink": "#121212", "characters": "#ffffff"},
    "dark": {"seal": "#e5484d", "ink": "#ffffff", "characters": "#ffffff"},
}


def seal_characters() -> str:
    source = SEAL_SOURCE.read_text()
    return re.search(r'<path class="characters" d="([^"]+)"', source).group(1)


def wordmark_path(font_file: str) -> tuple[str, float]:
    font = instantiateVariableFont(TTFont(font_file), {"wght": WEIGHT, "wdth": WIDTH})
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = FONT_SIZE / font["head"].unitsPerEm
    cap_height = font["OS/2"].sCapHeight * scale
    baseline = (SEAL_SIZE + cap_height) / 2
    pen = SVGPathPen(glyphs, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
    x = 0.0
    for char in WORDMARK:
        glyph = glyphs[cmap[ord(char)]]
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += glyph.width * scale + TRACKING_EM * FONT_SIZE
    return pen.getCommands(), x - TRACKING_EM * FONT_SIZE


def logo(colours: dict[str, str], characters: str, wordmark: str, wordmark_width: float) -> str:
    width = SEAL_SIZE + GAP + wordmark_width
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.2f} {SEAL_SIZE}" width="{width:.2f}" height="{SEAL_SIZE}" role="img" aria-label="Kuroshiro">
  <rect width="{SEAL_SIZE}" height="{SEAL_SIZE}" rx="5" fill="{colours['seal']}"/>
  <path fill="{colours['characters']}" d="{characters}"/>
  <path transform="translate({SEAL_SIZE + GAP} 0)" fill="{colours['ink']}" d="{wordmark}"/>
</svg>
"""


def main() -> None:
    wordmark, wordmark_width = wordmark_path(sys.argv[1])
    characters = seal_characters()
    for theme, colours in THEMES.items():
        (ROOT / f"logo-{theme}.svg").write_text(logo(colours, characters, wordmark, wordmark_width))


if __name__ == "__main__":
    main()
