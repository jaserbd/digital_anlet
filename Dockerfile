# Single-host build: one image serves both the API and the built React app.
# Same base image in every stage to avoid Prisma engine musl/glibc mismatches.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

FROM deps AS frontend-build
COPY tsconfig.base.json ./
COPY shared ./shared
COPY frontend ./frontend
# vite.config.ts outDir writes directly to backend/public
RUN npm run build -w frontend

FROM deps AS backend-build
COPY tsconfig.base.json ./
COPY shared ./shared
COPY backend ./backend
RUN npx prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build -w backend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/prisma ./backend/prisma
COPY --from=backend-build /app/backend/package.json ./backend/package.json
COPY --from=frontend-build /app/backend/public ./backend/public
EXPOSE 8080
# Not root (ONBOARDING_SECURITY_PLAN.md Phase 6): the app only reads its files. The local prisma
# binary rather than npx, which wants a writable cache.
USER node
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=backend/prisma/schema.prisma && node backend/dist/server.js"]
