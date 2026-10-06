# The TRMNL framework is pinned per Instance, bumped by Renovate, and optionally pinned per Plugin

The screen shell loaded TRMNL's framework CSS and JS from `usetrmnl.com/{css,js}/latest/`, so every Screen of every Plugin could change at once whenever TRMNL shipped a framework release (issue #1127). Kongroo's triage concluded that no versioned paths existed. That was wrong: it tried `v1`, `1.0` and similar, while TRMNL serves every release at an exact `X.Y.Z` path (`trmnl.com/css/3.4.0/plugins.css`) and states on its releases page that a release "is never rebuilt". The framework has been MIT-licensed since 3.2 (`usetrmnl/trmnl-framework`); its fonts are OFL or CC BY, and Highcharts, which it loads separately, is commercial. Grilling settled the following.

- **The Instance pins an exact version.** The shell loads `https://trmnl.com/{css,js}/<version>/plugins.{css,js}`, starting at 3.4.0. That also drops the 301 from the old `usetrmnl.com` host.
- **Renovate moves the pin.** A custom regex manager follows `usetrmnl/trmnl-framework` GitHub releases and opens one PR per release, so a framework change arrives as a reviewable PR with the UI screenshot specs run against it, not as a silent change on every Instance.
- **A Plugin may pin its own Framework Version**, as trmnlp and LaraPaper allow. It is a nullable exact `X.Y.Z` on the Plugin, checked for format only; null means the Instance pin and follows its bumps. A version TRMNL does not have shows up at once in the preview, where the CSS fails to load.
- **`latest` is never stored.** A Recipe's `framework_version` is imported when it is an exact version; `latest` or no value imports as null. Avoiding the moving path is the point of this decision. `.trmnlp` export writes the field back when set, and the Configuration Archive carries it like any other Plugin field.
- **A Mashup uses the Instance pin**, whatever its slot Plugins name. A Mashup is one document with one `<head>`, so it can load one framework; following the slots when they agree would make a Mashup change silently when one Plugin's setting changes. The template editor's slot-size preview follows the same rule and says so.
- **Every drawing of a Plugin uses its effective version**: the browser preview, the device preview (ADR-0040) and `/display`.

## Considered and rejected

- **Self-hosting the framework.** The license allows it with the MIT, OFL and CC BY notices shipped alongside, but `plugins.css` alone is 18.7 MB and pulls about 2.3 MB of fonts from a root-relative `/fonts/` path. It would only help an Instance without internet access, which still could not fetch Data Sources, import Recipes, or load maps and Highcharts. Neither Terminus nor LaraPaper nor trmnlp vendors it either.
- **Leaving it at `latest`.** Every Screen changes the moment TRMNL ships, and trmnlp moved away from the `/latest/` path for exactly that reason.
- **An Instance Setting for the version.** It asks every admin a question almost none of them can judge; the per-Plugin pin covers the Plugin that needs a different one.
- **Storing `latest` per Plugin.** It would bring back the problem for the Plugins that asked for it.

## Consequences

- The Plugin gains a nullable `frameworkVersion` column via migration.
- The shell takes the version as an input instead of reading a constant; the Instance pin remains one constant in `packages/shared`, which is what the Renovate manager rewrites.
- An Instance running an older Kuroshiro release keeps the version it shipped with until it is updated.
- Additive follow-ups: listing known versions in the Plugin's field from TRMNL's release manifest, per-Plugin versions inside a Mashup if TRMNL ever scopes the framework per slot.
