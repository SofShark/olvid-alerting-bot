# 1. Etapa base para dependencias y herramientas comunes
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# 2. Etapa de construcción (build) — better-sqlite3 needs node-gyp to
# compile a native binding; python/make/g++ are only in this stage.
FROM base AS build
RUN apk add --no-cache python3 make g++
COPY --link package*.json ./
RUN npm ci  # 'npm ci' es más rápido y limpio para entornos de integración/Docker

COPY --link . .

# Generamos el cliente de Prisma antes de compilar Nuxt
RUN npx prisma generate
RUN npm run build

# 3. Etapa final de ejecución (Produce una imagen ultra ligera)
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

# Nos traemos SOLO el resultado final compilado por Nuxt.
# Also copy the compiled better-sqlite3 native binding from node_modules
# so runtime doesn't need to rebuild it.
COPY --from=build /app/.output ./.output
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Bind-mount target from docker-compose (`./data` on host → `/data` here).
# `db push` writes the SQLite file into this directory on first boot.
RUN mkdir -p /data

# pre-install prisma pacakge (used to synchronize db schema)
RUN npx prisma

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Perform db migrations then start server
# Arrancamos la aplicación directamente de forma eficiente
CMD ["sh", "-c", "npx prisma db push --url ${DATABASE_URL} && node .output/server/index.mjs"]