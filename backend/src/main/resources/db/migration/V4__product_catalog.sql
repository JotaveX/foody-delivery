-- Fixed product catalog. It is reference data (the app has no routes to create, edit or delete
-- products), so it is seeded here and changes only through new migrations, in every environment.
-- image_key is the object path in the public images bucket; the API builds the URL from
-- catalog.image-base-url, so moving the images (another bucket, a CDN) needs no data change.

CREATE TABLE products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          VARCHAR(60)  NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    description   VARCHAR(200) NOT NULL,
    category      VARCHAR(30)  NOT NULL
        CHECK (category IN ('LANCHES', 'PIZZA', 'BRASILEIRA', 'JAPONESA', 'SALGADOS',
                            'SOBREMESAS_BEBIDAS')),
    price_cents   BIGINT       NOT NULL CHECK (price_cents > 0),
    image_key     VARCHAR(200) NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT 1,
    display_order INTEGER      NOT NULL
);

CREATE INDEX ix_products_active_order ON products (active, display_order);

INSERT INTO products (slug, name, description, category, price_cents, image_key, display_order)
VALUES
    ('x-burguer', 'X-Burguer',
     'Hambúrguer bovino de 150 g, queijo, alface, tomate e maionese da casa.',
     'LANCHES', 2490, 'catalog/x-burguer.webp', 10),
    ('x-bacon', 'X-Bacon',
     'Hambúrguer bovino de 150 g, queijo, bacon crocante e molho especial.',
     'LANCHES', 2990, 'catalog/x-bacon.webp', 20),
    ('cachorro-quente', 'Cachorro-quente',
     'Duas salsichas, purê, vinagrete, milho e batata palha.',
     'LANCHES', 1690, 'catalog/cachorro-quente.webp', 30),
    ('batata-frita', 'Batata frita',
     'Porção de 400 g de batata frita crocante.',
     'LANCHES', 1990, 'catalog/batata-frita.webp', 40),
    ('pizza-calabresa', 'Pizza de Calabresa',
     'Grande, 8 fatias: calabresa, cebola, mussarela e azeitonas.',
     'PIZZA', 5490, 'catalog/pizza-calabresa.webp', 50),
    ('pizza-mussarela', 'Pizza de Mussarela',
     'Grande, 8 fatias: mussarela, rodelas de tomate e orégano.',
     'PIZZA', 4990, 'catalog/pizza-mussarela.webp', 60),
    ('pizza-margherita', 'Pizza Margherita',
     'Grande, 8 fatias: mussarela, tomate, manjericão fresco e azeite.',
     'PIZZA', 5290, 'catalog/pizza-margherita.webp', 70),
    ('marmita-frango-grelhado', 'Marmita de Frango Grelhado',
     'Filé de frango grelhado, arroz, feijão e legumes no vapor.',
     'BRASILEIRA', 2290, 'catalog/marmita-frango-grelhado.webp', 80),
    ('prato-feito', 'Prato Feito',
     'Arroz, feijão, bife acebolado e salada.',
     'BRASILEIRA', 2790, 'catalog/prato-feito.webp', 90),
    ('feijoada', 'Feijoada',
     'Feijoada completa com arroz, couve, farofa, torresmo e laranja.',
     'BRASILEIRA', 3990, 'catalog/feijoada.webp', 100),
    ('strogonoff-frango', 'Strogonoff de Frango',
     'Strogonoff cremoso com arroz branco e batata palha.',
     'BRASILEIRA', 2990, 'catalog/strogonoff-frango.webp', 110),
    ('parmegiana-frango', 'Parmegiana de Frango',
     'Filé de frango empanado com molho de tomate e mussarela, arroz e fritas.',
     'BRASILEIRA', 3690, 'catalog/parmegiana-frango.webp', 120),
    ('combinado-sushi', 'Combinado de Sushi (20 peças)',
     'Niguiri, uramaki, hossomaki e sashimi de salmão.',
     'JAPONESA', 6990, 'catalog/combinado-sushi.webp', 130),
    ('temaki-salmao', 'Temaki de Salmão',
     'Cone de alga com arroz, salmão fresco, cream cheese e cebolinha.',
     'JAPONESA', 3290, 'catalog/temaki-salmao.webp', 140),
    ('yakisoba', 'Yakisoba',
     'Macarrão oriental com carne, frango e legumes ao molho shoyu.',
     'JAPONESA', 3890, 'catalog/yakisoba.webp', 150),
    ('coxinha', 'Coxinha',
     'Coxinha de frango com catupiry, massa crocante.',
     'SALGADOS', 890, 'catalog/coxinha.webp', 160),
    ('pastel-carne', 'Pastel de Carne',
     'Pastel de feira recheado com carne moída temperada.',
     'SALGADOS', 1290, 'catalog/pastel-carne.webp', 170),
    ('esfiha-carne', 'Esfiha de Carne',
     'Esfiha aberta de carne temperada com limão e especiarias.',
     'SALGADOS', 790, 'catalog/esfiha-carne.webp', 180),
    ('acai-500ml', 'Açaí 500 ml',
     'Açaí cremoso com banana, granola e leite condensado.',
     'SOBREMESAS_BEBIDAS', 2690, 'catalog/acai-500ml.webp', 190),
    ('refrigerante-lata', 'Refrigerante Lata',
     'Lata de 350 ml, gelada.',
     'SOBREMESAS_BEBIDAS', 690, 'catalog/refrigerante-lata.webp', 200);

-- order_items now points at a product and keeps unit_price_cents as a snapshot of the product
-- price when the order was created, so later price changes never alter past orders. name and
-- image_url are gone: both come from the product.
--
-- SQLite's ALTER TABLE can't add a NOT NULL foreign key or drop these columns, so the table is
-- rebuilt (create, copy, drop, rename). There is nothing to copy: orders in the old format (free
-- text items) only ever existed in dev, can't be mapped to products, and are discarded here,
-- together with their history. Children first, because foreign keys are enforced.

DELETE FROM order_items;
DELETE FROM order_status_history;
DELETE FROM orders;

CREATE TABLE order_items_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders (id),
    product_id       INTEGER NOT NULL REFERENCES products (id),
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents BIGINT  NOT NULL CHECK (unit_price_cents > 0)
);

-- (The copy step is empty: the old rows were discarded above.)
DROP TABLE order_items;
ALTER TABLE order_items_new RENAME TO order_items;

CREATE INDEX ix_order_items_order ON order_items (order_id);
CREATE INDEX ix_order_items_product ON order_items (product_id);
