# Foody Delivery

[![CI](https://github.com/JotaveX/foodyDelivery/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/JotaveX/foodyDelivery/actions/workflows/ci.yml)

Mini rastreador de pedidos de delivery.

- `backend/` — Java 21, Spring Boot 3, Maven, SQLite
- `frontend/` — React, Vite, TypeScript
- `infra/` — deploy (docker compose, Caddy, Litestream, GitHub Actions)

## Rodando localmente

```bash
docker compose up -d                     # Redis e Mailpit
cd backend && ./mvnw spring-boot:run     # API
cd frontend && npm install && npm run dev
```
