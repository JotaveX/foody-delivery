package dev.jotave.foody.support;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Catalog products for integration tests. The SQLite file is shared by every IT in the JVM, so
 * tests never change the seeded products: they insert their own, at the end of the menu.
 */
public final class TestProducts {

  private TestProducts() {}

  /** Id of a product seeded by the catalog migration. */
  public static long idOf(JdbcTemplate jdbc, String slug) {
    return jdbc.queryForObject("SELECT id FROM products WHERE slug = ?", Long.class, slug);
  }

  /** Inserts a LANCHES product with a unique slug and returns its id. */
  public static long insert(JdbcTemplate jdbc, long priceCents, boolean active) {
    String slug = "test-" + UUID.randomUUID();
    jdbc.update(
        """
        INSERT INTO products (slug, name, description, category, price_cents, image_key, active,
                              display_order)
        VALUES (?, 'Produto de teste', 'Só para testes.', 'LANCHES', ?, 'catalog/test.webp', ?,
                9999)
        """,
        slug,
        priceCents,
        active);
    return idOf(jdbc, slug);
  }
}
