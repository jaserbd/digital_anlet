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
CMD ["sh", "-c", "npx prisma migrate deploy --schema=backend/prisma/schema.prisma && node backend/dist/server.js"]
