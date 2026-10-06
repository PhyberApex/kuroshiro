---
layout: home

hero:
  name: Kuroshiro
  text: Unleash your TRMNL
  tagline: An open-source, self-hosted BYOS server for TRMNL e-ink devices. One Docker image with the API and admin UI, plus your own Postgres.
  image:
    light: /screenshots/device-screens-light.png
    dark: /screenshots/device-screens-dark.png
    alt: A Device's Screens in the Kuroshiro admin UI
  actions:
    - theme: brand
      text: Try the live demo
      link: https://kuroshiro-demo.phyberapex.de/
    - theme: alt
      text: Get started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/PhyberApex/kuroshiro

features:
  - title: Auto provisioning
    details: Enter the server URL on a Device's Wi-Fi setup page and it shows up the moment it calls in. Rename, reset, tweak refresh rates and trigger Special Functions from there.
    link: /tour/devices
    linkText: Devices
  - title: Screens galore
    details: Upload images, fetch links, write HTML with a live preview, or combine Plugins into Mashups. Gate any Screen to a day/time Schedule.
    link: /tour/screens
    linkText: Screens
  - title: Plugins and Recipes
    details: Poll external APIs through multiple named Data Sources or accept pushed Webhooks, render with Liquid, or import a Recipe straight from trmnl.com.
    link: /tour/plugins
    linkText: Plugins
  - title: Alerts
    details: A periodic sweep watches for low battery, offline Devices and failing Data Sources, and notifies you through an Apprise sidecar.
    link: /tour/alerts
    linkText: Alerts
  - title: Firmware & Device Models
    details: Every panel size and colour depth TRMNL sells, synced daily. Official or custom Firmware, blocked unless it fits the Device's model.
    link: /tour/firmware
    linkText: Firmware & Device Models
  - title: Metrics and a Device Simulator
    details: Scrape battery, Wi-Fi, Sensor and Alert gauges with Prometheus, and poll as any Device without hardware.
    link: /tour/metrics
    linkText: Prometheus Metrics
---
