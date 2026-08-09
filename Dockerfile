# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_DEFAULT_PROXY=https://corsproxy.io/?
ENV VITE_DEFAULT_PROXY=$VITE_DEFAULT_PROXY
ARG VITE_DEFAULT_API_KEYS=
ENV VITE_DEFAULT_API_KEYS=$VITE_DEFAULT_API_KEYS
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 3000
CMD ["node", "dist-server/server/index.js"]
