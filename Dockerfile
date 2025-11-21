# Stage 1: Build ui
FROM node:24-alpine AS ui-build
WORKDIR /app
COPY packages/ui ./packages/ui
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter ./packages/ui build
RUN pnpm --filter ./packages/ui build

# Stage 2: Build api
FROM node:24-alpine AS api-build
WORKDIR /app
COPY packages/api ./packages/api
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy built ui static files from previous stage
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter ./packages/api run build

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

# Copy api bundle and static files only
COPY --from=api-build /app/packages/api/dist ./dist
COPY --from=ui-build /app/packages/ui/dist ./public

# Install only production dependencies
COPY packages/api/package.json ./package.json
RUN corepack enable && pnpm install --prod

# Use tini as the entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"] 