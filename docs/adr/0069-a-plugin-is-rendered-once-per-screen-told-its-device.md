# A Plugin is rendered once per Screen, told its Device

TRMNL gives a template `trmnl.device` (trmnlp's `UserDataAssembler#device_namespace`): the Device's `friendly_id`, `percent_charged`, `wifi_strength`, `firmware_version`, `refresh_interval_seconds` and sleep window, and the panel's `width`, `height`, `model`, `bit_depth` and `orientation`. Recipes lay out by it (`trmnl.device.width | default: 480`), branch on `orientation` and show the battery. Kuroshiro gave no `trmnl.device`, so the fallbacks hid the gap on an OG and laid an X or a portrait Device out at the wrong size (#1537). A scheduled render wrote one output into the cache of every Screen of the Plugin, so there was no single Device to tell. ADR-0057 left `trmnl.device.*` out for that reason; this supersedes that part of its "Not in this decision" line, and the rest of ADR-0057 stands.

**A Plugin's data is fetched once per tick, and its `full` Template is then rendered once per Screen of the Plugin, told that Screen's Device as `trmnl.device`; each output is cached to its own Screen.** The size, `model` and `bit_depth` are those of the Device Model the Device is rendered at, which is the page the template is laid out on, with an OG for a Device that has none yet; `orientation` is `portrait` when that page is taller than it is wide. The on-demand render of `/display`, a Mashup slot and the preview of a chosen Device tell the Device the same way.

The maintainer settled it, against the two cheaper options in the issue, because N Liquid renders per tick are cheap at the size Kuroshiro's fleets are: a self-hosted instance runs a handful of Devices, a Plugin sits on few of them, and a Liquid render is milliseconds against a fetch that is often a second. The fetch, which is the costly and rate-limited part, still happens once.

- Every Screen is rendered before the first is written, so a Template that fails for one Device caches nothing, as before. A scheduled render asks again whether a newer tick has started just before that first write, since N renders widen the window, and writes nothing if one has.
- A Plugin on no Screen is still rendered once, without a Device, so a scheduled render still reports a broken Template.
- `trmnl.device` is laid on after the fetch, so a Data Source's URL, headers and body never read it: one fetch serves every Screen. A polling URL that names `{{ trmnl.device.friendly_id }}` renders it empty.
- `wifi_strength` is left out: Kuroshiro stores the raw RSSI and has no TRMNL-equal way to read it as a percentage. A key the Device has not reported or set is left out too, so the template's `default` applies.
- `sensors` stay empty on the Plugin's own Screen, as before (#1121); rendering per Screen would allow the Device's own, which is left for its own issue.

## Considered options

- **Render once per Device Model**, telling only the size, `model`, `bit_depth` and `orientation`. Rejected: fewer renders, but no battery or `friendly_id`, and a second way of keying the cache.
- **Tell every render the Instance's default Device Model.** Rejected: only true for a fleet of OGs.

## Consequences

- A tick costs one Liquid render per Screen of the Plugin; a Plugin on many Devices renders that many times.
- Two Screens of a Plugin can cache different output. The preview tells `trmnl.device` only when it is for a chosen Device; for no Device the template's fallbacks apply.
