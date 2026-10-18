# Foody Delivery — Mini Rastreador de Pedidos

Desafio técnico de processo seletivo: um mini rastreador de pedidos de delivery.

## Estrutura do monorepo

```
backend/    Java 21, Spring Boot 3, Maven
frontend/   React, Vite, TypeScript
infra/      Deploy (docker compose, Caddy, Litestream; front no Cloudflare Pages)
```

## Requisitos obrigatórios do desafio

- **Autenticação**: cadastro (nome, e-mail, senha), login por e-mail/senha; apenas usuários autenticados acessam o sistema.
- **API REST**:
  - criar pedido (cliente, itens, endereço de entrega);
  - atualizar status: `RECEBIDO`, `EM_PREPARO`, `SAIU_PARA_ENTREGA`, `ENTREGUE`, `CANCELADO`;
  - listar todos os pedidos;
  - buscar pedido por ID.
- **Persistência** em SQLite.
- **Front-end** em React listando pedidos com o status atual e permitindo criar pedido.
- **Git** com histórico de commits.

## Decisões de arquitetura

- **SQLite em modo WAL**, schema versionado com **Flyway**. Nunca usar `spring.jpa.hibernate.ddl-auto=update` (use `validate` ou `none`); toda mudança de schema é uma nova migration.
- **Redis guarda todo estado efêmero fora da JVM**: rate limit, idempotência, cache e pub/sub do WebSocket. A aplicação é **stateless** (nada de sessão HTTP, cache em memória local ou estado em singletons). O único gargalo de escala consciente é o SQLite.
- **Toda dependência externa tem substituto local** no docker-compose de dev:
  - Redis → container Redis;
  - e-mail → Mailpit;
  - Google Cloud Storage → storage local de arquivos.
  
  O projeto precisa subir **sem nenhuma credencial real**.
- **Produção**: frontend no **Cloudflare Pages** (`foody.jotave.dev`, upload direto via Wrangler no GitHub Actions); API numa VM e2-micro na Compute Engine (Free Tier, `us-east1`) rodando docker compose, com Caddy (HTTPS) em `api.foody.jotave.dev` (registro DNS only, sem proxy da Cloudflare); Litestream replicando o SQLite para o GCS. Passo a passo em `infra/SETUP.md`.
- **Roteamento**: em dev o front chama `/api` e `/ws` pelo proxy do Vite (mesma origem). Em produção usa `VITE_API_URL`/`VITE_WS_URL` (definidas no build) e fala com `api.foody.jotave.dev` cross-origin; o CORS e o `Origin` aceito no `/ws` vêm de `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`, origens exatas) e `app.cors.allowed-origin-patterns` (`CORS_ALLOWED_ORIGIN_PATTERNS`, ex.: `https://*.foody.pages.dev` para os previews do Pages).
- **Free Tier do GCP**: a VM tem 1 GB de RAM. Os limites de memória do compose somam ~800M, e o backend roda com `-Xmx350m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k` (no `backend/Dockerfile`). Mudanças que aumentem memória, disco, imagens no Artifact Registry ou operações no GCS precisam caber nos limites da seção "Custos" do `infra/SETUP.md`.

## Convenções

- Commits seguem **Conventional Commits**, em inglês (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`, `ci:`…).
- Código (identificadores, comentários) em **inglês**.
- Mensagens de erro retornadas pela API em **português**.
- DTOs são **Java records**.
- **Nunca expor entidades JPA nos controllers** — sempre mapear para DTOs.
- **Sem Lombok**.
- **Pacotes por feature** (ex.: `auth`, `order`, `user`), não por camada.
- Testes:
  - unitários com sufixo `*Test` → rodam no **Surefire** (`mvn test`);
  - integração com sufixo `*IT` → rodam no **Failsafe** (`mvn verify`).
- **Cada fase termina com todos os testes passando e um commit.**

## Regras de domínio

### Endereços

- **Endereços são imutáveis.** Editar (`PUT /addresses/{id}`) cria um novo registro (novo id) e faz soft delete (`deleted_at`) no antigo, preservando o `is_default`. Excluir é sempre soft delete. Motivo: pedidos têm FK para o endereço usado na entrega, e o histórico não pode mudar retroativamente.
- **O cadastro não pede endereço**: o usuário cadastra o primeiro ao fazer o primeiro pedido (`newAddress` no `POST /orders`) ou em `/addresses`, e ele vira o padrão automaticamente.
- **Todo usuário com algum endereço ativo tem exatamente um padrão**, garantido pelo índice único parcial `ux_addresses_default` (`WHERE is_default = 1 AND deleted_at IS NULL`) e pelo `AddressService`.
- **Não é permitido excluir o endereço padrão** (é preciso eleger outro antes) **nem o último endereço ativo**. Ambos retornam 409 com mensagem específica.
- **Usuário só enxerga e altera os próprios endereços**; endereço de outro usuário (ou já excluído) retorna 404, para não revelar que existe.
- **Armadilha do Hibernate:** no flush, INSERTs rodam antes dos UPDATEs. Toda escrita que libera uma vaga num índice único (desmarcar o padrão, soft delete da versão antiga) precisa de `saveAndFlush` **antes** da escrita que ocupa a vaga; senão o índice é violado.
- Conflitos de concorrência (violação de índice único, SQLite ocupado além do `busy_timeout`, `@Version`) viram 409 genérico no `GlobalExceptionHandler`.

### Pedidos

- Tabela `orders` (não `order`, palavra reservada), com `order_items` e `order_status_history`. Sem `ON DELETE CASCADE`: `orders.address_id` aponta para o endereço imutável exato da entrega, mesmo após edição/exclusão.
- **Dinheiro em centavos (`BIGINT`)**: o SQLite não tem decimal exato (`DECIMAL` vira REAL). No domínio e na API é `BigDecimal` com 2 casas; o `MoneyCentsConverter` converte e recusa frações de centavo.
- **Máquina de estados** em `OrderStatus.canTransitionTo`: `RECEBIDO → EM_PREPARO | CANCELADO`; `EM_PREPARO → SAIU_PARA_ENTREGA | CANCELADO`; `SAIU_PARA_ENTREGA → ENTREGUE`; `ENTREGUE` e `CANCELADO` são terminais.
- Status só muda por `Order.changeStatus(next, user)` (sem setter), que lança `InvalidStatusTransitionException` (409) e registra o histórico. A criação registra `null → RECEBIDO`. `@Version` faz lock otimista.
- `totalAmount` é calculado dos itens na criação e persistido; itens não mudam depois.
- No SQLite, só a PK precisa ser declarada exatamente `INTEGER PRIMARY KEY` (as entidades mapeiam com `@JdbcTypeCode(SqlTypes.INTEGER)`); demais colunas inteiras podem ser `BIGINT`.

## Comandos

### Backend (`backend/`)

```bash
./mvnw spring-boot:run          # sobe a API em dev (perfil dev é o default; requer docker compose up)
./mvnw test                     # testes unitários (*Test, Surefire)
./mvnw verify                   # unitários + integração (*IT, Failsafe; requer Docker p/ Testcontainers)
./mvnw -Dtest=NomeDaClasseTest test       # um teste unitário específico
./mvnw -Dit.test=NomeDaClasseIT verify    # um teste de integração específico
./mvnw clean package            # gera o jar em target/
./mvnw spotless:apply           # formata com google-java-format (spotless:check roda no verify)
```

### Frontend (`frontend/`)

```bash
npm install                     # instala dependências
npm run dev                     # Vite dev server (proxy de /api e /ws para o backend)
npm run build                   # type-check + build de produção em dist/
npm run lint                    # lint (oxlint)
npm test                        # testes (Vitest em watch; `npm run test:ci` roda uma vez)
```

### Serviços locais (`docker-compose.yml` na raiz)

```bash
docker compose up -d            # na raiz: Redis (6379) e Mailpit (SMTP 1025, UI http://localhost:8025)
docker compose down
```

### Infra (`infra/`)

Produção é implantada pelo `.github/workflows/deploy.yml` (backend: docker compose na VM com Caddy + Litestream, via `infra/deploy.sh`; frontend: `wrangler pages deploy`).

> Os comandos acima refletem a estrutura planejada; ajuste esta seção se nomes de arquivos ou scripts mudarem durante a implementação.

## Git hooks (guardrails locais)

O `package.json` da raiz contém **só tooling** (husky, lint-staged, commitlint). `npm install` na raiz instala os hooks (`core.hooksPath=.husky/_`). Cada hook olha os arquivos alterados e **pula a parte do monorepo que não foi tocada** (`backend/` ou `frontend/`; a parte do frontend também é pulada enquanto `frontend/package.json` não existir).

| Hook | O que roda |
|---|---|
| `commit-msg` | `commitlint` com `@commitlint/config-conventional`. |
| `pre-commit` (rápido, só o que está staged) | `lint-staged`: `oxlint --fix` + `prettier --write` nos arquivos staged de `frontend/` (com `frontend/` como cwd, via `scripts/frontend-exec.sh`). Se houver arquivos de `backend/` staged: `./mvnw spotless:check test` (só unitários `*Test`, sem `*IT`). Se houver arquivos de `frontend/` staged: `vitest run`. |
| `pre-push` (suíte completa) | Considera os arquivos alterados nos commits sendo enviados. Backend: `./mvnw verify` (unitários + `*IT` + `spotless:check`). Frontend: `npm run lint && npm run test:ci && npm run build`. Branch nova sem base conhecida em `<remote>/main` → roda tudo. |

Os hooks são uma conveniência: podem ser pulados com `git commit --no-verify` / `git push --no-verify`. **O CI é o guardrail definitivo** e precisa rodar as mesmas verificações (commitlint, spotless, testes, lint, build) em todo push/PR.

Se o `spotless:check` falhar, rode `./mvnw spotless:apply` em `backend/`. O `google-java-format` está fixado em 1.36.1 porque a 1.37.0 quebra no Spotless 3.10.4; atualize os dois juntos.

## Backend: notas de configuração

- Spring Boot 3.5.x, `groupId` `dev.jotave.foody`, pacote raiz `dev.jotave.foody`.
- SQLite em `./data/tracker.db` (sobrescrevível com `SQLITE_PATH`); os PRAGMAs `journal_mode=WAL`, `busy_timeout=5000` e `foreign_keys=true` vão na URL JDBC e são aplicados a cada conexão. `SqliteDirectoryInitializer` cria o diretório do arquivo.
- Perfis: `dev` é o default (defaults locais para segredos, SMTP no Mailpit, storage local); `prod` exige `JWT_SECRET`, `SMTP_HOST`, `GCS_BUCKET` etc. via variáveis de ambiente e loga em JSON.
- Actuator expõe só `health`, com `/actuator/health/liveness` e `/actuator/health/readiness` (readiness inclui Redis).
- `CorrelationIdFilter` propaga `X-Correlation-Id` (MDC `correlationId`).
- Testes de integração estendem `dev.jotave.foody.support.IntegrationTest` (Redis via Testcontainers + SQLite em diretório temporário por execução). O container Redis é **singleton da JVM** (não `@Container`): com `@Container` ele seria reiniciado em outra porta a cada classe, e os contextos Spring em cache ficariam apontando para a porta antiga. A base sobe os limites de rate limit (todos os testes vêm de 127.0.0.1); `RateLimitIT` sobrescreve com `@TestPropertySource`.
- **Idempotência**: `@Idempotent` em métodos de controller autenticados que retornam `ResponseEntity` (`idempotency/IdempotencyAspect`). Detalhes no README.
- **WebSocket**: STOMP em `/ws`, simple broker em `/topic`. JWT no frame CONNECT (`realtime/StompAuthInterceptor`, mesma validação do HTTP via `auth/TokenAuthenticator`). `order/OrderEventsPublisher` (AFTER_COMMIT) publica o `OrderDetail` no canal Redis `order-events`; `order/OrderEventsRelay` repassa para `/topic/orders` e `/topic/orders/{id}`. O `OrderChangedEvent` carrega o snapshot `OrderDetail` mapeado dentro da transação.
- **Rate limit**: `ratelimit/RateLimitFilter` roda na cadeia de segurança logo depois do JWT. Os buckets do Bucket4j ficam no Redis através de um `RedisClient` Lettuce próprio, montado a partir de `RedisConnectionDetails`. O `X-Forwarded-For` só é lido quando o peer está em `app.rate-limit.trusted-proxies` (`ClientIpResolver`).
