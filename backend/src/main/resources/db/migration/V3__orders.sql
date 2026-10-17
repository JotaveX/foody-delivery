-- Money is stored as integer cents: SQLite has no exact decimal type (DECIMAL gets NUMERIC
-- affinity and 19.99 would be stored as a REAL), so sums in SQL stay exact.
-- Columns declared BIGINT still get INTEGER affinity; only primary keys must be spelled
-- exactly "INTEGER PRIMARY KEY" to alias the rowid.
-- No ON DELETE CASCADE anywhere: users, addresses and orders are never physically deleted, and
-- an order must keep pointing at the exact (immutable) address it was delivered to.

CREATE TABLE orders (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name      VARCHAR(100) NOT NULL,
    address_id         INTEGER      NOT NULL REFERENCES addresses (id),
    status             VARCHAR(20)  NOT NULL
        CHECK (status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')),
    total_amount_cents BIGINT       NOT NULL CHECK (total_amount_cents > 0),
    created_by         INTEGER      NOT NULL REFERENCES users (id),
    created_at         TIMESTAMP    NOT NULL,
    updated_at         TIMESTAMP    NOT NULL,
    version            INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX ix_orders_status ON orders (status);
CREATE INDEX ix_orders_created_at ON orders (created_at);
CREATE INDEX ix_orders_address ON orders (address_id);
CREATE INDEX ix_orders_created_by ON orders (created_by);

CREATE TABLE order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER      NOT NULL REFERENCES orders (id),
    name             VARCHAR(100) NOT NULL,
    quantity         INTEGER      NOT NULL CHECK (quantity > 0),
    unit_price_cents BIGINT       NOT NULL CHECK (unit_price_cents > 0),
    image_url        VARCHAR(500)
);

CREATE INDEX ix_order_items_order ON order_items (order_id);

CREATE TABLE order_status_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER     NOT NULL REFERENCES orders (id),
    -- NULL only on the first entry (creation: NULL -> RECEBIDO).
    from_status VARCHAR(20)
        CHECK (from_status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')),
    to_status   VARCHAR(20) NOT NULL
        CHECK (to_status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')),
    changed_at  TIMESTAMP   NOT NULL,
    changed_by  INTEGER     NOT NULL REFERENCES users (id)
);

CREATE INDEX ix_order_status_history_order ON order_status_history (order_id);
CREATE INDEX ix_order_status_history_changed_by ON order_status_history (changed_by);
