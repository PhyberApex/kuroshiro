# Device Simulator

The **Device Simulator** makes the firmware's setup and `/display` calls from your browser, so you can poll as any Device without hardware. It lives on the Instance pages.

Its calls are real. A setup call with an unknown MAC registers a new Device, and a poll advances that Device's Rotation, overwrites what it last reported and consumes a pending Special Function, Device Reset or Firmware push. That makes it the quickest way to see how your Screens render and rotate, or to troubleshoot a Device that is behaving oddly.

The [live demo](https://kuroshiro-demo.phyberapex.de/) is a good place to try it: the demo resets once a day.
