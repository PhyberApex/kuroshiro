# Plugins

A **Plugin** pulls outside data into a [Liquid](https://shopify.github.io/liquid/) **Template** and renders it for every Device it is assigned to, full screen or in a Mashup slot. The Plugin page puts the Template, a live preview, its Data Sources, Field Values and Devices on one page.

<ThemedShot name="plugin" />

## Poll and Webhook

- **Poll**: Kuroshiro fetches on a shared refresh interval. A Poll Plugin can hold multiple named **Data Sources**, each either its own HTTP request (method, URL, headers, body, optional JavaScript transform) or a literal, hand-entered JSON value. They are fetched in parallel and exposed to the Template under their own names. If one source fails, the rest still render.
- **Webhook**: an external system `POST`s JSON to the Plugin's own token-secured URL, and Kuroshiro renders on arrival. Choose how each POST combines with what is already stored: replace it (`standard`), merge objects recursively (`deep_merge`), or append to an array up to a limit (`stream`).

<ThemedShot name="plugins" />

## Recipe import

Don't want to build a Plugin from scratch? Paste the id or [trmnl.com/recipes](https://trmnl.com/recipes) URL of a **Recipe** and Kuroshiro imports it as a ready-to-use Poll Plugin, including Recipes with a serverless transform. Nothing updates by itself: a **Recipe Update Check** downloads the Recipe again and shows what changed before anything is applied.

## Sensors in Templates

For OG Devices with a Qwiic sensor add-on, the CO₂, humidity, pressure and temperature readings are available to every Template as `sensors.*`, with no extra setup.

## When a Data Source keeps failing

Each fetch-mode Data Source counts its consecutive failed scheduled fetches. Once that streak reaches a threshold, an [Alert](./alerts) opens for that Data Source, and it resolves on the next successful fetch.
