CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    -- Bumped to revoke every JWT issued before (logout everywhere, password change).
    token_version INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL
);

CREATE TABLE addresses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER      NOT NULL REFERENCES users (id),
    label        VARCHAR(30),
    street       VARCHAR(150) NOT NULL,
    number       VARCHAR(20)  NOT NULL,
    complement   VARCHAR(100),
    neighborhood VARCHAR(100) NOT NULL,
    city         VARCHAR(100) NOT NULL,
    state        VARCHAR(2)   NOT NULL,
    zip_code     VARCHAR(8)   NOT NULL,
    is_default   BOOLEAN      NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    NOT NULL,
    deleted_at   TIMESTAMP
);

CREATE INDEX ix_addresses_user ON addresses (user_id);

-- At most one active default address per user.
CREATE UNIQUE INDEX ux_addresses_default ON addresses (user_id) WHERE is_default = 1 AND deleted_at IS NULL;
