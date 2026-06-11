# 1. Etapa base para dependencias y herramientas comunes
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# 2. Etapa de construcción (build)
FROM base AS build 
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

# Nos traemos SOLO el resultado final compilado por Nuxt
COPY --from=build /app/.output ./.output
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Arrancamos la aplicación directamente de forma eficiente
CMD ["node", ".output/server/index.mjs"]