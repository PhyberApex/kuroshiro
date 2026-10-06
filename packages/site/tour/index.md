# Tour

Kuroshiro is the server a TRMNL calls in to. It decides what each Device shows and in what order, renders it for the Device's panel, and keeps an eye on the Devices while they run. Everything is managed in one admin UI that ships in the same Docker image as the API.

Every screenshot on these pages comes from that admin UI with sample data, and follows this site's light or dark theme. To click through the real thing, open the [live demo](https://kuroshiro-demo.phyberapex.de/); it resets once a day.

<ThemedShot name="devices" />

| Area | What you get |
|---|---|
| [Devices](./devices) | Auto provisioning, Settings, Sleep Mode, Mirroring, Special Functions, Sensors and logs |
| [Screens](./screens) | Uploads, links, HTML, Plugin and Mashup Screens, Order and Schedules |
| [Plugins](./plugins) | Poll and Webhook Plugins, Data Sources, Liquid Templates and Recipe import |
| [Alerts](./alerts) | Low battery, offline and failing Data Source Alerts, delivered through Apprise |
| [Firmware & Device Models](./firmware) | Every TRMNL Device Model and Palette, custom Palettes, official and custom Firmware |
| [Prometheus Metrics](./metrics) | Device, Sensor, Alert and Data Source gauges at `GET /metrics` |
| [Device Simulator](./simulator) | Poll as any Device without hardware |
