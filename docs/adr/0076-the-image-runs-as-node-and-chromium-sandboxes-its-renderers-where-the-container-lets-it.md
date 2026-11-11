# The image runs as `node`, and Chromium sandboxes its renderers where the container lets it

The image ran everything as root, and Chromium launched with `--no-sandbox`. Chromium renders third-party markup: imported Recipes (ADR-0072) and, on the demo, anonymous visitors' HTML through `/api/device-preview`. So a renderer exploit ran as root in a container whose environment holds the database credentials. Issue #1743.

- **The image's user is `node` (uid 1000).** Only `/app/public` belongs to it, because that is all Kuroshiro writes. Its runtime directories (`screens/devices`, `firmware`, `colormaps`) exist in the image, so a fresh named volume mounted on one starts out owned by `node` too. The code and `node_modules` stay root's.
- **Started as root, the entrypoint hands the files over and drops privileges.** With `--user 0`, or from an image built on this one that sets `USER root` (the Home Assistant add-on), `entrypoint.sh` changes the owner of whatever under `/app/public` and `/app/uploads` is not `node`'s already. The volume paths are followed when they are links root made, so the add-on's `/data` targets are included. Below them the walk does not follow links, so a link `node` planted cannot get root to change the owner of anything else. Then it re-runs itself as `node` through `su-exec`.
- **Started as `node` over a directory it cannot write, the entrypoint refuses to start** and prints the two ways out: one start with `--user 0`, or a `chown -R 1000:1000` of the volume (`docker run --rm -v <volume>:/data alpine chown -R 1000:1000 /data`). A volume written by the earlier root image is the case it catches. Otherwise every render, upload and Firmware sync into that volume would fail one by one.
- **Chromium tries its sandbox first and falls back to `--no-sandbox`.** The launch is sandboxed unless the process is root, which Chromium refuses to sandbox. When that launch fails, a warning is logged and every relaunch goes straight to `--no-sandbox` until the browser is closed. Docker's default seccomp profile denies the user namespaces the sandbox needs, so under a plain `docker run` the fallback is what happens. With `--security-opt seccomp=unconfined` (or a profile that allows `clone`/`unshare` of user namespaces), the renderers are sandboxed.
- **The sandboxed launch adds `--disable-gpu-sandbox`.** Under Alpine's musl Chromium, the GPU process's seccomp-bpf filter kills it on `pwritev2`, and Chromium gives up on every page. Only the GPU process is let out; the renderers that run the markup keep their sandbox.

## Considered and rejected

- **Start as root every time and always drop privileges in the entrypoint.** Upgrades would then need nothing, but `docker run <image> id` would still be root, and so would anything else run in the container without the entrypoint.
- **Ship a seccomp profile, or the `chrome-sandbox` setuid helper.** A profile is a file each install has to pass, and the Home Assistant Supervisor does not take one. Alpine's Chromium has no setuid helper.

## Consequences

- An install whose volume the root image wrote stops at the first start of this image, with a message that names the directory and the fix. Starting it once with `--user 0` is enough. A bind mount handed over that way changes its owner on the host.
- An image built on this one has to set `USER root` before installing packages or starting anything as root.
- A Chromium renderer is sandboxed only where the container allows user namespaces; elsewhere it runs unsandboxed as `node`, no longer as root.
