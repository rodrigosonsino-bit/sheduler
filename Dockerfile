# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development

# Build packages/whatsapp-core first (backend depends on it via file:../packages/whatsapp-core)
COPY packages/whatsapp-core/package.json ./packages/whatsapp-core/
WORKDIR /app/packages/whatsapp-core
RUN npm install --ignore-scripts
COPY packages/whatsapp-core/ ./
RUN npm run build

# Build backend
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm ci --ignore-scripts
WORKDIR /app
COPY backend/ ./backend/
WORKDIR /app/backend
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine
WORKDIR /app

# whatsapp-core: manifest + built dist + prod deps
COPY packages/whatsapp-core/package.json ./packages/whatsapp-core/
COPY --from=builder /app/packages/whatsapp-core/dist ./packages/whatsapp-core/dist
WORKDIR /app/packages/whatsapp-core
RUN npm install --omit=dev --ignore-scripts

# backend: manifest + prod deps (resolves file:../packages/whatsapp-core, already present above)
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev --ignore-scripts

# Compiled output and runtime assets (public/ e migrations/ já são arquivos versionados, não gerados no build)
COPY --from=builder /app/backend/dist ./dist
COPY backend/public ./public
COPY backend/migrations ./migrations

EXPOSE 3000
CMD ["npm", "start"]
