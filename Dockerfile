# ═══════════════════════════════════════════════════════════════════════════
# FaceVision Enterprise Platform — Multi-Stage Production Dockerfile
# Inspired by CompreFace Enterprise Deployment Architecture
# ═══════════════════════════════════════════════════════════════════════════

# Stage 1: Build Workspace
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Install dependencies and build all workspace projects
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install runtime system dependencies for Sharp image processing
RUN apk add --no-libc-compat vips-dev

# Copy built artifacts from builder stage
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./package.json
COPY --from=builder /app/apps/web/dist/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/healthz || exit 1

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
