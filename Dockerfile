# Multistage build — frontend (Vite) + backend (TypeScript) → single Node image
# for Cloud Run. The runtime stage contains only production deps + compiled
# output + static frontend.

# ── Stage 1: frontend build ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app
# Copy lockfiles first for caching
COPY package.json package-lock.json ./
RUN npm ci
# Copy source
COPY vite.config.js index.html eslint.config.js ./
COPY src/ ./src/
# Note: this repo has no `public/` folder — Vite handles missing one gracefully.
# Add `COPY public/ ./public/` here if you ever introduce static assets.

# For Cloud Run we serve from root `/`, override the gh-pages base path
ENV VITE_BASE=/
RUN npm run build

# ── Stage 2: backend build ──────────────────────────────────────────────────
FROM node:22-alpine AS backend
WORKDIR /app
COPY carepal-backend/package.json carepal-backend/package-lock.json ./
RUN npm ci
COPY carepal-backend/ ./
RUN npm run build

# ── Stage 3: production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install production deps only
COPY carepal-backend/package.json carepal-backend/package-lock.json ./
RUN npm ci --omit=dev

# Compiled backend + migrations + OpenAPI spec
COPY --from=backend /app/dist ./dist
COPY --from=backend /app/migrations ./migrations

# Static frontend goes next to the backend as `public/` (see src/index.ts)
COPY --from=frontend /app/dist ./public

# Cloud Run sets PORT, default to 8080
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
