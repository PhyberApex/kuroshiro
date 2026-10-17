# Colour conversion changes are judged on emulated Ink, gated on flat UI and text, and the status quo wins ties

ADR-0002 adopted Terminus's saturation boost in front of the colour remap and recorded that no hardware test was performed. Terminus has since replaced that boost with a sigmoidal contrast curve on the brightness channel of HSV (issue #1458), and the question of which treatment is better on a real panel was filed as needing physical hardware. Nobody maintaining Kuroshiro owns a colour panel, and ADR-0002 already found that for `4bwry` and `6a` the firmware's colour classification is open source. Grilling settled the following.

- **A colour conversion candidate is judged on the Ink it produces, not on the PNG it writes.** The firmware's classification for `4bwry` and `6a` is ported from a named commit of `usetrmnl/firmware` and applied to each candidate's output; what is compared is the emulated print. The PNG is an intermediate, and a pretty PNG whose reds classify as white is a failure. `3bwr` and `7a` have no classification code to port and are not judged.
- **Two mechanical gates precede any eyeballing.** On a flat page with red and yellow accents, the accents must print on red and yellow Ink. On a page of text, every pixel must print on black or white Ink with no coloured Ink anywhere, with Dithering on and with it off (ADR-0045), because a single stray coloured pixel on a text Screen is a visible speckle. A candidate that fails a gate is out regardless of how its photo looks.
- **The photo is judged by a human, side by side, after the gates.** There is no metric for "a nicer photo" worth trusting over a maintainer's eye.
- **Three candidates, not two.** The current operators, Terminus's current operators verbatim including the fact that its remap runs while the image is still in HSV colorspace, and the current operators with Terminus's contrast curve inserted in front of them unchanged. The two treatments act on different axes, brightness and saturation, so "both" is a real option and is exactly what a swap would ship.
- **The status quo wins ties.** Swapping operators changes the output of every colour Device on upgrade; that cost needs a visible gain. Equal is not a gain.
- **The verdict is recorded under ADR-0002 either way**, as a consequence line, so a later review of Terminus does not reopen the question without new evidence. The emulation harness is not committed; it is a one-off and the firmware it ports moves.

## Considered and rejected

- **Waiting for hardware.** Blocks indefinitely and still ends in one person's eye on one panel; the emulation is at least reproducible and names the firmware it models.
- **Adopting Terminus's change because Terminus made it.** ADR-0002 adopted the boost on the strength of the firmware thresholds, not because Terminus had it; the same standard applies to its replacement.
- **A perceptual metric for the photo.** Delta-E against the source rewards the candidate that changes the least, which is the one ADR-0002 found loses its reds.
- **Judging `3bwr` and `7a` too.** Nothing trustworthy to emulate against; guessing would be worse than silence.

## Consequences

- Issue #1458 loses `ready-for-human`: it needs no panel.
- The firmware commit the emulation ports is named in the issue and in ADR-0002's consequence line, so the verdict can be dated against later firmware changes to the thresholds.
- A future colour conversion change for `4bwry` or `6a` has a method to follow instead of a hardware prerequisite.
