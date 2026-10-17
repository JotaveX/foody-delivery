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

## Idempotência e rate limit

Ambos guardam estado no Redis, então valem para todas as instâncias da API.

### `Idempotency-Key` no `POST /orders`

Header opcional com um UUID. O front gera um ao abrir o formulário de novo pedido e o reutiliza em
toda retentativa do envio.

| Situação | Resposta |
|---|---|
| Primeira vez com a chave | Cria o pedido e guarda status, `Location` e corpo por 24h (`app.idempotency.ttl`) |
| Mesma chave e mesmo corpo, já concluída | Devolve a resposta salva, com `Idempotent-Replayed: true` |
| Mesma chave, corpo diferente | `422` |
| Mesma chave, primeira requisição ainda rodando | `409` (tente de novo em instantes) |
| Requisição falhou (exceção ou 5xx) | A chave é liberada, e a retentativa roda de novo |

A chave no Redis é `idem:{userId}:{key}`, então cada usuário tem as suas. O comportamento vem da
anotação `@Idempotent` (`IdempotencyAspect`) e serve para qualquer endpoint autenticado que
retorne `ResponseEntity`.

### Rate limit (Bucket4j + Redis)

| Escopo | Rota | Limite padrão |
|---|---|---|
| IP | `POST /auth/login` | 5/min |
| IP | `POST /auth/register` | 3/min |
| IP | `POST /auth/forgot-password` | 3/min (já configurado para quando a rota existir) |
| Usuário | toda requisição autenticada | 100/min |

Os limites ficam em `app.rate-limit` no `application.yml` (`RATE_LIMIT_ENABLED=false` desliga
todos). As respostas trazem `X-RateLimit-Remaining`. Quem passa do limite recebe `429` em
ProblemDetail com `Retry-After` (segundos). Se o Redis cair, o rate limit deixa as requisições
passarem em vez de derrubar a API.

**IP real e proxy confiável.** O `X-Forwarded-For` é só um header: qualquer cliente pode inventar
um. Por isso a API só o lê quando a conexão TCP vem de um proxy listado em
`RATE_LIMIT_TRUSTED_PROXIES` (IPs ou CIDRs, separados por vírgula; vazio por padrão, e aí o header
é ignorado). Em produção, aponte essa variável para o endereço do Caddy na rede do Docker (ex.: a
sub-rede do compose, como `172.18.0.0/16`). Sem `trusted_proxies` próprio, o Caddy substitui o
`X-Forwarded-For` que vem da internet pelo IP real do cliente. A API percorre o header da direita
para a esquerda, pulando os proxies confiáveis, e o primeiro endereço não confiável é o do cliente.
Nunca inclua uma faixa que clientes da internet alcancem diretamente.

## Atualizações em tempo real (WebSocket + STOMP)

O front se conecta em `/ws` (STOMP sobre WebSocket puro) e assina `/topic/orders` (lista) e
`/topic/orders/{id}` (detalhe). Cada mensagem é o pedido completo, no mesmo formato do
`GET /orders/{id}`.

- **Autenticação:** o JWT vai no header `Authorization: Bearer …` do frame `CONNECT`, nunca na
  URL (que acabaria em logs de proxy). O `StompAuthInterceptor` aplica a mesma validação do
  filtro HTTP, incluindo o `token_version`; sem token válido o `CONNECT` é recusado. Clientes só
  podem fazer `SUBSCRIBE` em `/topic/**`; `SEND` é recusado.
- **Fan-out pelo Redis:** depois do commit (`@TransactionalEventListener(AFTER_COMMIT)`), o pedido
  é publicado no canal Redis `order-events`. Toda instância assina esse canal e repassa a
  mensagem para os seus clientes pelo broker local. Assim, com várias instâncias, o cliente recebe
  a mudança mesmo conectado em outra instância que não a que a processou.
- **Origens:** `WS_ALLOWED_ORIGINS` (padrões separados por vírgula; em dev, `http://localhost:*`).
