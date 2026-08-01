# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development

# Single npm workspace covering backend/ + packages/whatsapp-core, so both
# resolve ioredis/pg from ONE shared node_modules install (avoids the
# duplicate-install type-identity problem: see docker/backend-workspace.package.json).
COPY docker/backend-workspace.package.json ./package.json
COPY docker/backend-workspace.package-lock.json ./package-lock.json
COPY backend/package.json ./backend/package.json
COPY packages/whatsapp-core/package.json ./packages/whatsapp-core/package.json
RUN npm ci --ignore-scripts

# Build packages/whatsapp-core first (backend depends on it via file:../packages/whatsapp-core)
COPY packages/whatsapp-core/ ./packages/whatsapp-core/
WORKDIR /app/packages/whatsapp-core
RUN npm run build

# Build backend
WORKDIR /app
COPY backend/ ./backend/
WORKDIR /app/backend
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine
WORKDIR /app

# Same synthetic workspace, prod-only install, so runtime module resolution
# also shares a single ioredis/pg install between backend and whatsapp-core.
COPY docker/backend-workspace.package.json ./package.json
COPY docker/backend-workspace.package-lock.json ./package-lock.json
COPY backend/package.json ./backend/package.json
COPY packages/whatsapp-core/package.json ./packages/whatsapp-core/package.json
RUN npm ci --omit=dev --ignore-scripts

# whatsapp-core: built dist
COPY --from=builder /app/packages/whatsapp-core/dist ./packages/whatsapp-core/dist

# backend: compiled output and runtime assets (public/ e migrations/ já são
# arquivos versionados, não gerados no build)
WORKDIR /app/backend
COPY --from=builder /app/backend/dist ./dist
COPY backend/public ./public
COPY backend/migrations ./migrations

EXPOSE 3000
CMD ["npm", "start"]
