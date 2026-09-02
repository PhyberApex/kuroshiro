# Stage 1: Build ui
FROM node:24-alpine AS ui-build
WORKDIR /app
COPY packages/ui ./packages/ui
COPY packages/shared ./packages/shared
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter ./packages/ui build

# Stage 2: Build api
FROM node:24-alpine AS api-build
WORKDIR /app
COPY packages/api ./packages/api
COPY packages/shared ./packages/shared
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter ./packages/api run build && pnpm --filter ./packages/api run build:migrations

# Deploy the api's production node_modules, pinned exactly to pnpm-lock.yaml.
# --legacy: this workspace doesn't inject workspace packages (see the kuroshiro-shared
#   note below), which pnpm's default deploy implementation requires.
# --no-optional: drops typeorm's optional peer on ts-node (otherwise pulled in because
#   ts-node is a devDependency elsewhere in the workspace lockfile, dragging in
#   ts-node/typescript/@swc-core for a CLI path this image never uses) and pg's optional
#   pg-cloudflare (Cloudflare Workers transport, dead code on plain Node.js). Nothing
#   else in the runtime tree declares an optionalDependency.
RUN pnpm --filter ./packages/api deploy --legacy --prod --no-optional --ignore-scripts /prod/api

# Stage 3: Production image
FROM node:24-alpine AS production
WORKDIR /app

# Pupeteer fix
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install tini
RUN apk add --no-cache tini

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
COPY --from=api-build /prod/api/node_modules ./node_modules
COPY --from=api-build /app/packages/api/dist ./dist
COPY --from=ui-build /app/packages/ui/dist ./public

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Use tini as the entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

ENV NODE_ENV=production
EXPOSE 3000
CMD ["/app/entrypoint.sh"] 