# check=skip=SecretsUsedInArgOrEnv
# Production Dockerfile for Kanban Editor

# Build with command 
# docker build -f Dockerfile.prod \
#   --build-arg GITHUB_TOKEN=$GITHUB_TOKEN \
#   -t kanban-editor:<version> .


FROM node:20-alpine AS builder

ARG GITHUB_TOKEN

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@edufeed-org:registry=https://npm.pkg.github.com/" >> .npmrc

# Install ALL dependencies (including dev) needed for build
RUN pnpm install --frozen-lockfile --prefer-offline

# Add sirv-cli for serving in production
RUN pnpm add sirv-cli

RUN rm -f .npmrc

COPY . .

ENV NODE_ENV=production
RUN pnpm run build:site

FROM node:20-alpine

RUN apk add --no-cache curl dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -h /app -s /bin/sh -G nodejs nodejs

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/package.json /app/pnpm-lock.yaml ./

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nodejs:nodejs /app/build ./build

COPY --from=builder --chown=nodejs:nodejs /app/static ./static

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production \
    HOST=0.0.0.0

USER nodejs

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5173/ || exit 1

ENTRYPOINT ["dumb-init", "--"]

# Serve static files with sirv
CMD ["pnpm", "exec", "sirv", "build", "--single", "--host", "0.0.0.0", "--port", "5173"]


FROM node:22-alpine as development
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /home/node/app

COPY package.json pnpm-lock.yaml ./