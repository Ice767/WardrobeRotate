FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3100

CMD ["npm", "start"]
