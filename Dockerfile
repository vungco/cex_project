# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Layer cache: reinstall only when lockfile changes
COPY package.json package-lock.json ./
RUN npm ci

# Only files required for `nest build` (avoids huge invalidations from COPY .)
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# Drop devDependencies here so runner copies a single production tree
RUN npm prune --omit=dev

# Stage 2: Runner — no second `npm ci`
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8003

CMD ["node", "dist/main.js"]
