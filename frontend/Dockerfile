# syntax=docker/dockerfile:1

# Local full-stack image (docker-compose.yml). Production serves dist/ from Cloudflare Pages.

# ---- build: type-check and bundle the SPA ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
# VITE_API_URL / VITE_WS_URL stay unset: the SPA calls /api and /ws on its own origin.
RUN npm run build

# ---- runtime: static files plus the /api and /ws proxy ----
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
