# The device preview dithers the browser preview's own HTML, on demand, one at a time

Every preview in the template editor and on Edit HTML is a browser's drawing: smooth greys and anti-aliased type. The Device gets that drawing dithered to its Palette, where a light fill, a thin rule or small type can come out very differently. Issue #1111 asks to show the real image. Grilling settled the following.

- **The UI sends the HTML it is already drawing.** The request carries the body HTML of the browser preview (Liquid already rendered in the browser by the shared engine, ADR-0020) plus the Device Model and Palette. The server wraps it in the same screen shell `/display` uses, screenshots it at the Device Model's size and converts it as `/display` does. Sending the unsaved Template and having the server render the Liquid would need a second path for Edit HTML and could drift from the browser preview; this way the device preview is the browser preview after the Device's conversion step. An admin can already have the server render arbitrary HTML through an HTML Screen, demo mode included, so the endpoint exposes nothing new.
- **One browser launch per render**, as every other render does. A long-lived browser would speed up `/display` too, so it is its own decision and not made inside a preview feature.
- **Both editors offer it**: the Plugin template editor and Edit HTML, through the same endpoint.
- **One device preview render at a time per Instance, in every mode.** A request that arrives while one is running is refused with 429. It protects a small self-hosted machine as much as the public demo, without introducing throttling infrastructure the project does not have.
- **A Render Signal does not stop it.** The image is drawn anyway and the response says which signal the content raised, so an author can check a flag works. Nothing is stored, so no verdict is remembered (ADR-0031 is unaffected).
- **The PNG is returned in the response** and not written to disk or cached.
- **A slot-size Template** is drawn as the browser preview draws it, in its slot of an empty Mashup layout; that comes with the HTML.
- **On demand, never live.** The plate shows the device preview until anything it was drawn from changes (the Template or HTML, a Field Value, the data, the chosen Device, Device Model or Palette), and then returns to the live browser drawing. An image that no longer matches the Template would mislead more than none.

## Considered and rejected

- **Rendering Liquid on the server from the unsaved Template.** It duplicates what the shared engine already does in the browser and needs a separate request shape for Edit HTML.
- **A per-IP or per-minute rate limiter.** It would be the first throttling in the codebase, for a load a single-render cap already bounds.
- **Keeping the last device preview after an edit, marked stale.** Comparing a stale dithered image with a live drawing invites exactly the confusion the feature removes.

## Consequences

- A password Field Value reaches the browser preview as eight dots, so it is drawn as dots in the device preview too. A Template that prints a password is already wrong, so this is accepted.
- The device preview is only as faithful as the shell and conversion it shares with `/display`; changing either changes both, which is the point.
- Additive follow-ups: a long-lived browser for all renders, showing the device preview in the Plugin page's Screen previews.
