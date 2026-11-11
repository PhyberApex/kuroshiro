# Stage 1: Build ui
FROM node:26-alpine AS ui-build
WORKDIR /app
# Chrome is never needed at build time (the production stage uses Alpine's chromium via
# PUPPETEER_EXECUTABLE_PATH), and puppeteer's download crashes with SIGILL under QEMU on
# linux/arm64. Skips both the puppeteer postinstall and the root prepare script's install.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY packages/ui ./packages/ui
COPY packages/shared ./packages/shared
# pnpm's frozen install refuses a lockfile naming a workspace project whose manifest is
# absent from the build context, so every manifest is present and --filter keeps the
# install to this stage's own dependency subtree.
COPY packages/api/package.json ./packages/api/package.json
COPY packages/site/package.json ./packages/site/package.json
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN npm install -g corepack && corepack enable && pnpm install --frozen-lockfile --filter kuroshiro-ui...
RUN pnpm --filter ./packages/ui build

# Stage 2: Build api
FROM node:26-alpine AS api-build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/site/package.json ./packages/site/package.json
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN npm install -g corepack && corepack enable && pnpm install --frozen-lockfile --filter kuroshiro-api...
RUN pnpm --filter ./packages/api run build && pnpm --filter ./packages/api run build:migrations

# Deploy the api's production node_modules, pinned exactly to pnpm-lock.yaml.
# --legacy: this workspace doesn't inject workspace packages (see the kuroshiro-shared
#   note below), which pnpm's default deploy implementation requires.
# --no-optional: drops typeorm's optional peer on ts-node (otherwise pulled in because
#   ts-node is a devDependency elsewhere in the workspace lockfile, dragging in
#   ts-node/typescript/@swc-core for a CLI path this image never uses) and pg's optional
#   pg-cloudflare (Cloudflare Workers transport, dead code on plain Node.js). typeorm also
#   marks pg itself optional (one of many DB-driver peers), but pg stays installed since
#   it's a direct runtime dependency of packages/api independent of that peer flag.
RUN pnpm --filter ./packages/api deploy --legacy --prod --no-optional --ignore-scripts /prod/api

# Stage 3: Production image
FROM node:26-alpine AS production
WORKDIR /app

# Pupeteer fix
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# tini reaps Chromium's children; su-exec lets the entrypoint drop root (see entrypoint.sh)
RUN apk add --no-cache tini su-exec

# Install ImageMagick
RUN apk add --no-cache \
    imagemagick \
    libjpeg-turbo-dev \
    libpng-dev \
    giflib-dev \
    tiff-dev

# Copy api bundle, its lockfile-pinned runtime node_modules, and static files only.
# node_modules here comes straight from `pnpm deploy` in api-build, so it is not
# reinstalled in this stage and cannot drift from pnpm-lock.yaml. The api's workspace
# devDependencies (e.g. kuroshiro-shared) are bundled into dist at build time and must
# not be reintroduced here.
# Only /app/public is written at runtime, so only it is owned by the unprivileged `node`
# user the app runs as; the code and node_modules stay root's and read-only to it.
COPY --from=api-build /prod/api/node_modules ./node_modules
COPY --from=api-build /app/packages/api/dist ./dist
# The api reads its own version from the package.json beside dist/ (Instance facts, Configuration Archive).
COPY --from=api-build /app/packages/api/package.json ./package.json
COPY --chown=node:node --from=ui-build /app/packages/ui/dist ./public
# The static last-resort Fallback Screens belong to the api and are served at
# /screens/<kind>.png whatever the UI stage ships.
COPY --chown=node:node --from=api-build /app/packages/api/assets/screens ./public/screens
# The directories written at runtime exist up front and belong to `node`, so a fresh named
# volume mounted on one (README, "Persisting data") starts out owned by `node` too.
RUN mkdir -p public/screens/devices public/firmware public/colormaps \
 && chown node:node public/screens/devices public/firmware public/colormaps

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# The app, ImageMagick and Chromium run unprivileged. Started as root instead (`--user 0`,
# or an image built on this one), the entrypoint hands /app/public to `node` and drops to it.
USER node

# Use tini as the entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

ENV NODE_ENV=production
EXPOSE 3000
CMD ["/app/entrypoint.sh"] 