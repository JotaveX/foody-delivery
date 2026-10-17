# Foody Delivery — Mini Rastreador de Pedidos

Desafio técnico de processo seletivo: um mini rastreador de pedidos de delivery.

## Estrutura do monorepo

```
backend/    Java 21, Spring Boot 3, Maven
frontend/   React, Vite, TypeScript
infra/      Deploy (docker compose, Caddy, Litestream, GitHub Actions)
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
- **Produção**: VM na Compute Engine rodando docker compose; Caddy como reverse proxy com HTTPS em `foody.jotave.dev`; Litestream replicando o SQLite para o GCS; deploy via GitHub Actions.
- **Roteamento**: em todos os ambientes o front chama a API em `/api` e o WebSocket em `/ws` — proxy do Vite em dev, Caddy em prod. **Sem CORS em produção** (mesma origem).

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

Produção é implantada pelo workflow do GitHub Actions (docker compose na VM, Caddy + Litestream).

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
- Testes de integração estendem `dev.jotave.foody.support.IntegrationTest` (Redis via Testcontainers + SQLite em diretório temporário por execução).
