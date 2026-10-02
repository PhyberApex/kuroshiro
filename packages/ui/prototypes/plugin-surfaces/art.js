// PROTOTYPE for wayfinder ticket #1092. Synthetic Screen images, the four Fallback Screens after #1090,
// the seal and the twelve icons of #1091. Injected once as an SVG sprite.

const SEAL_PATH = 'M13.77 31.8Q12.98 31.33 11.65 30.77Q10.31 30.21 9.18 29.94Q10.36 29.42 11.7 28.57Q13.03 27.72 14.22 26.82Q15.4 25.92 16.14 25.23H9.82V22.66H29.09V21.35H13.08V18.97H29.09V17.57H15.01V7.28H49.04V17.57H34.87V18.97H50.87V21.35H34.87V22.66H54.23V25.23H47.96Q49.78 26.3 51.56 27.58Q53.34 28.87 54.48 29.88Q53.79 30.07 52.82 30.39Q51.86 30.7 50.99 31.06Q50.13 31.42 49.59 31.69Q48.89 30.95 47.73 29.99Q46.57 29.03 45.29 28.08Q44 27.12 42.82 26.44L45.98 25.23H16.54L21.13 26.68Q19.7 28.05 17.7 29.47Q15.7 30.9 13.77 31.8ZM35.8 31.55Q35.56 30.76 35.14 29.81Q34.72 28.87 34.27 27.94Q33.83 27.01 33.33 26.33L38.62 25.53Q39.11 26.16 39.66 27.08Q40.2 28 40.65 28.97Q41.09 29.94 41.34 30.76Q40.3 30.84 38.59 31.07Q36.89 31.31 35.8 31.55ZM25.38 31.69Q25.28 30.92 25.01 29.95Q24.74 28.98 24.42 28.04Q24.1 27.09 23.7 26.41L29.09 25.81Q29.53 26.46 29.93 27.39Q30.32 28.32 30.62 29.31Q30.91 30.29 31.06 31.09Q29.97 31.14 28.25 31.31Q26.52 31.47 25.38 31.69ZM20.59 11.31H29.09V9.66H20.59ZM34.87 11.31H43.31V9.66H34.87ZM20.59 15.19H29.09V13.58H20.59ZM34.87 15.19H43.31V13.58H34.87ZM14.22 58.96V39.59H25.33Q25.87 38.93 26.47 38.05Q27.06 37.18 27.58 36.33Q28.1 35.48 28.34 34.88L35.66 35.26Q35.26 35.87 34.69 36.65Q34.12 37.43 33.51 38.21Q32.89 38.98 32.35 39.59H49.98V58.96ZM20.49 56.03H43.71V50.56H20.49ZM20.49 47.69H43.71V42.51H20.49Z'

const display = 'font-family="Archivo Variable, sans-serif" font-weight="800" style="font-stretch:68%;letter-spacing:-0.015em"'
const text = 'font-family="Archivo Variable, sans-serif" font-weight="500"'
const mono = 'font-family="JetBrains Mono Variable, monospace" font-weight="500"'

// One sheet for no-screen, error and sleep: headline, one sentence, a rule, the Device and the Instance, the black seal.
const noticeSheet = (id, { headline, lines = [], inverted = false }) => {
  const ink = inverted ? '#fff' : '#000'
  const paper = inverted ? '#000' : '#fff'
  return `
  <symbol id="s-${id}" viewBox="0 0 800 480">
    <rect width="800" height="480" fill="${paper}"/>
    <g fill="${ink}">
      <text x="56" y="126" font-size="88" ${display}>${headline}</text>
      ${lines.map((line, n) => `<text x="56" y="${186 + n * 35}" font-size="27" ${text}>${line}</text>`).join('')}
      <rect x="56" y="352" width="688" height="4"/>
      <text x="56" y="400" font-size="24" ${text}>Kitchen</text>
      <text x="56" y="432" font-size="21" ${mono}>http://kuroshiro.local:3000</text>
      <text x="672" y="436" font-size="34" text-anchor="end" ${display}>Kuroshiro</text>
      <rect x="684" y="376" width="60" height="60" rx="4.7"/>
      <path transform="translate(684 376) scale(0.9375)" fill="${paper}" d="${SEAL_PATH}"/>
    </g>
  </symbol>`
}

const sprite = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <pattern id="d50" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#0a0a0a"/><rect x="2" y="2" width="2" height="2" fill="#0a0a0a"/></pattern>
    <pattern id="d25" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#0a0a0a"/></pattern>
    <pattern id="dh" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#0a0a0a"/></pattern>

    <symbol id="s-calendar" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="40" y="84" font-size="30" font-weight="700">Thursday</text>
        <text x="30" y="262" font-size="190" font-weight="700">1</text>
        <text x="40" y="318" font-size="30">October 2026</text>
        <rect x="290" y="40" width="2" height="350"/>
        <g font-size="26">
          <text x="324" y="84" font-weight="700">08:30</text><text x="420" y="84">Dentist, Dr. Okafor</text>
          <text x="324" y="140" font-weight="700">12:00</text><text x="420" y="140">Lunch with Mirela</text>
          <text x="324" y="196" font-weight="700">15:15</text><text x="420" y="196">School pickup</text>
          <text x="324" y="252" font-weight="700">19:00</text><text x="420" y="252">Climbing gym</text>
        </g>
        <rect x="324" y="290" width="436" height="2" fill="url(#d50)"/>
        <text x="324" y="340" font-size="22" font-weight="700">Tomorrow</text>
        <text x="324" y="376" font-size="22">Recycling out, 07:00</text>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">Calendar</text>
        <text x="760" y="460" font-size="22" text-anchor="end">Kitchen</text>
      </g>
    </symbol>

    <symbol id="s-weather" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="34" y="220" font-size="200" font-weight="700">14°</text>
        <text x="40" y="290" font-size="34" font-weight="700">Rain from 15:00</text>
        <text x="40" y="334" font-size="24">High 16°, low 9°, wind 18 km/h</text>
        <rect x="440" y="250" width="32" height="90" fill="url(#d25)"/>
        <rect x="484" y="230" width="32" height="110" fill="url(#d25)"/>
        <rect x="528" y="200" width="32" height="140" fill="url(#d50)"/>
        <rect x="572" y="150" width="32" height="190" fill="url(#d50)"/>
        <rect x="616" y="90" width="32" height="250"/>
        <rect x="660" y="60" width="32" height="280"/>
        <rect x="704" y="120" width="32" height="220"/>
        <rect x="440" y="340" width="296" height="2"/>
        <g font-size="18" text-anchor="middle"><text x="456" y="370">09</text><text x="544" y="370">13</text><text x="632" y="370">17</text><text x="720" y="370">21</text></g>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">Weather</text>
        <text x="760" y="460" font-size="22" text-anchor="end">Lindenplatz</text>
      </g>
    </symbol>

    <symbol id="s-photo" viewBox="0 0 800 480">
      <rect width="800" height="480" fill="url(#d25)"/>
      <rect width="800" height="150" fill="#fff"/>
      <circle cx="610" cy="110" r="46" fill="#fff" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M0 250 L140 150 L260 220 L420 120 L600 230 L800 170 L800 330 L0 330Z" fill="url(#d50)"/>
      <path d="M0 300 L220 240 L460 300 L800 250 L800 480 L0 480Z" fill="#0a0a0a"/>
      <rect y="350" width="800" height="130" fill="url(#dh)"/>
      <path d="M300 380 L460 380 L430 410 L325 410Z" fill="#fff" stroke="#0a0a0a" stroke-width="3"/>
      <rect x="376" y="300" width="4" height="80" fill="#fff"/>
      <path d="M382 306 L430 370 L382 370Z" fill="#fff"/>
    </symbol>

    <symbol id="s-photo2" viewBox="0 0 800 480">
      <rect width="800" height="480" fill="#fff"/>
      <rect y="300" width="800" height="180" fill="url(#d25)"/>
      <path d="M0 300 L120 220 L210 270 L330 150 L470 280 L560 230 L800 300Z" fill="#0a0a0a"/>
      <path d="M330 150 L372 190 L340 200 L318 186 L300 196Z" fill="#fff"/>
      <circle cx="140" cy="100" r="40" fill="url(#d50)"/>
      <rect y="380" width="800" height="100" fill="url(#dh)"/>
    </symbol>

    <symbol id="s-trains" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="40" y="76" font-size="32" font-weight="700">Departures, Lindenplatz</text>
        <rect x="40" y="100" width="720" height="3"/>
        <g font-size="28">
          <text x="40" y="156" font-weight="700">07:48</text><text x="160" y="156">S3</text><text x="240" y="156">Hauptbahnhof</text><text x="760" y="156" text-anchor="end">on time</text>
          <text x="40" y="216" font-weight="700">07:55</text><text x="160" y="216">U2</text><text x="240" y="216">Messe Nord</text><text x="760" y="216" text-anchor="end">+4 min</text>
          <text x="40" y="276" font-weight="700">08:03</text><text x="160" y="276">S3</text><text x="240" y="276">Flughafen</text><text x="760" y="276" text-anchor="end">on time</text>
        </g>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">Train departures</text>
      </g>
    </symbol>

    <symbol id="s-mashup" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="34" y="190" font-size="150" font-weight="700">14°</text>
        <text x="40" y="250" font-size="26" font-weight="700">Rain from 15:00</text>
        <rect x="40" y="290" width="320" height="80" fill="url(#d50)"/>
        <rect x="399" y="0" width="2" height="420"/>
        <text x="440" y="76" font-size="28" font-weight="700">Saturday</text>
        <g font-size="24">
          <text x="440" y="136" font-weight="700">10:00</text><text x="530" y="136">Market</text>
          <text x="440" y="186" font-weight="700">14:30</text><text x="530" y="186">Football, pitch 2</text>
        </g>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">Weekend board</text>
      </g>
    </symbol>

    <symbol id="s-bins" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="40" y="84" font-size="30" font-weight="700">Next collection</text>
        <text x="36" y="230" font-size="120" font-weight="700">Paper</text>
        <text x="40" y="300" font-size="34">Monday 5 October, out by 07:00</text>
        <rect x="40" y="340" width="720" height="2" fill="url(#d50)"/>
        <text x="40" y="386" font-size="24">Then: Residual waste, Thursday 8 October</text>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">Bin day</text>
      </g>
    </symbol>

    <symbol id="s-tide" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="40" y="76" font-size="32" font-weight="700">Tides, Lindenhafen</text>
        <path d="M40 260 C120 120 200 120 280 260 S440 400 520 260 S680 120 760 260 L760 380 L40 380Z" fill="url(#d25)"/>
        <path d="M40 260 C120 120 200 120 280 260 S440 400 520 260 S680 120 760 260" fill="none" stroke="#0a0a0a" stroke-width="4"/>
        <g font-size="24"><text x="120" y="130" font-weight="700">05:12 high</text><text x="350" y="410">11:31 low</text><text x="590" y="130" font-weight="700">17:40 high</text></g>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">Tide table</text>
      </g>
    </symbol>

    <symbol id="s-note" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="40" y="200" font-size="84" font-weight="700">Back at six.</text>
        <text x="40" y="270" font-size="34">Soup is in the fridge.</text>
      </g>
    </symbol>

    <symbol id="s-mirror" viewBox="0 0 800 480">
      <g fill="#0a0a0a" font-family="Helvetica, Arial, sans-serif">
        <text x="40" y="92" font-size="40" font-weight="700">Hacker News</text>
        <rect x="40" y="116" width="720" height="3"/>
        <g font-size="25">
          <text x="40" y="170">1.  A slower way to read the web</text>
          <text x="40" y="218">2.  E-paper drivers, explained from the waveform up</text>
          <text x="40" y="266">3.  Show HN: a calendar that fits on one line</text>
          <text x="40" y="314">4.  What a year of self-hosting taught me</text>
          <text x="40" y="362">5.  The return of the 1-bit aesthetic</text>
        </g>
        <rect y="420" width="800" height="2"/>
        <text x="40" y="460" font-size="22" font-weight="700">TRMNL</text>
      </g>
    </symbol>

    <symbol id="s-welcome" viewBox="0 0 800 480">
      <g fill="#000">
        <rect x="56" y="48" width="112" height="112" rx="8.75"/>
        <path transform="translate(56 48) scale(1.75)" fill="#fff" d="${SEAL_PATH}"/>
        <text x="194" y="142" font-size="108" ${display}>Kuroshiro</text>
        <rect x="56" y="190" width="688" height="4"/>
        <text x="56" y="262" font-size="30" ${text}>This Device is connected.</text>
        <text x="56" y="300" font-size="30" ${text}>Add its first Screen at</text>
        <text x="56" y="338" font-size="26" ${mono}>http://kuroshiro.local:3000</text>
        <text x="56" y="436" font-size="21" ${mono}>4F2A1C</text>
      </g>
    </symbol>
    ${noticeSheet('noscreen', { headline: 'No Screen to show', lines: ['Add a Screen to this Device, or check the', 'Schedules of the ones it has.'] })}
    ${noticeSheet('error', { headline: 'Mirroring failed', lines: ['Kuroshiro could not fetch this Device’s image', 'from TRMNL. It tries again at the next refresh.'] })}
    ${noticeSheet('sleep', { headline: 'Asleep until 06:00', inverted: true })}

    <symbol id="seal" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="5"/>
      <path style="fill: var(--seal-paper, var(--color-paper))" d="${SEAL_PATH}"/>
    </symbol>
    <symbol id="seal-small" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="1.25"/>
      <path style="fill: var(--seal-paper, var(--color-paper))" fill-rule="evenodd" d="M6 2h2v2H6zM3 4h10v10H3zM5 6v2h6V6zM5 10v2h6v-2z"/>
    </symbol>

    <symbol id="i-grip" viewBox="0 0 16 16"><path d="M5 3h2v2H5zM9 3h2v2H9zM5 7h2v2H5zM9 7h2v2H9zM5 11h2v2H5zM9 11h2v2H9z"/></symbol>
    <symbol id="i-chev" viewBox="0 0 16 16"><path d="M3.2 5.4 8 10.2l4.8-4.8 1.1 1.1L8 12.4 2.1 6.5z"/></symbol>
    <symbol id="i-up" viewBox="0 0 16 16"><path d="M8 3.2 2.6 8.6l1.1 1.1L8 5.4l4.3 4.3 1.1-1.1z"/></symbol>
    <symbol id="i-down" viewBox="0 0 16 16"><path d="M8 12.8 2.6 7.4l1.1-1.1L8 10.6l4.3-4.3 1.1 1.1z"/></symbol>
    <symbol id="i-close" viewBox="0 0 16 16"><path d="M3.6 2.5 8 6.9l4.4-4.4 1.1 1.1L9.1 8l4.4 4.4-1.1 1.1L8 9.1l-4.4 4.4-1.1-1.1L6.9 8 2.5 3.6z"/></symbol>
    <symbol id="i-check" viewBox="0 0 16 16"><path d="M6.2 10.6 12.9 3.9 14 5l-7.8 7.8L2 8.6l1.1-1.1z"/></symbol>
    <symbol id="i-plus" viewBox="0 0 16 16"><path d="M7.2 2.5h1.6v4.7h4.7v1.6H8.8v4.7H7.2V8.8H2.5V7.2h4.7z"/></symbol>
    <symbol id="i-copy" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5 1.5h9.5V11H13V3H5zM1.5 5H11v9.5H1.5zM3 6.5V13h6.5V6.5z"/></symbol>
    <symbol id="i-external" viewBox="0 0 16 16"><path d="M2.5 3.5H7V5H4v7h7V9h1.5v4.5h-10zM9 2.5h4.5V7H12V5.06L7.53 9.53 6.47 8.47 10.94 4H9z"/></symbol>
    <symbol id="i-search" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M7 2.25a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5zm0 1.5a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5zM10.9 9.8l3.4 3.4-1.1 1.1-3.4-3.4z"/></symbol>
    <symbol id="i-upload" viewBox="0 0 16 16"><path d="M8 2 3.6 6.4l1.1 1.1 2.5-2.5V11h1.6V5l2.5 2.5 1.1-1.1zM2.5 12.5h11V14h-11z"/></symbol>
    <symbol id="i-problem" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2 2h12v12H2zM7.2 4.5v4.6h1.6V4.5zM7.2 10.2v1.6h1.6v-1.6z"/></symbol>
  </defs>
</svg>`
