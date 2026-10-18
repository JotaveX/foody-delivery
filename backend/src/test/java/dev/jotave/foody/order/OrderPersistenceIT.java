package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jotave.foody.address.AddressRepository;
import dev.jotave.foody.address.AddressRequest;
import dev.jotave.foody.address.AddressService;
import dev.jotave.foody.catalog.Product;
import dev.jotave.foody.catalog.ProductRepository;
import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestProducts;
import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Checks the SQLite mapping of the order aggregate; ddl validation only compares types. */
class OrderPersistenceIT extends IntegrationTest {

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate tx;
  @Autowired private OrderRepository orders;
  @Autowired private UserRepository users;
  @Autowired private AddressRepository addresses;
  @Autowired private AddressService addressService;
  @Autowired private ProductRepository products;

  private long userId;
  private long addressId;

  @BeforeEach
  void createAccount() {
    String email = TestAccounts.create(http).email();
    userId = users.findByEmail(email).orElseThrow().getId();
    addressId =
        addresses.findByUserIdAndIsDefaultTrueAndDeletedAtIsNull(userId).orElseThrow().getId();
  }

  @Test
  void persistsTheAggregateWithExactMoney() {
    long orderId = createOrder();

    assertThat(
            jdbc.queryForObject(
                "SELECT total_amount_cents FROM orders WHERE id = ?", Long.class, orderId))
        .isEqualTo(5670L);
    assertThat(
            jdbc.queryForList(
                "SELECT unit_price_cents FROM order_items WHERE order_id = ? ORDER BY id",
                Long.class,
                orderId))
        .containsExactly(2490L, 690L);

    tx.executeWithoutResult(
        status -> {
          Order order = orders.findById(orderId).orElseThrow();
          assertThat(order.getTotalAmount()).isEqualTo(new BigDecimal("56.70"));
          assertThat(order.getStatus()).isEqualTo(OrderStatus.RECEBIDO);
          assertThat(order.getDeliveryAddress().getId()).isEqualTo(addressId);
          assertThat(order.getItems())
              .extracting(item -> item.getProduct().getSlug(), OrderItem::getUnitPrice)
              .containsExactly(
                  org.assertj.core.groups.Tuple.tuple("x-burguer", new BigDecimal("24.90")),
                  org.assertj.core.groups.Tuple.tuple("refrigerante-lata", new BigDecimal("6.90")));
          assertThat(order.getStatusHistory())
              .singleElement()
              .satisfies(
                  entry -> {
                    assertThat(entry.getFromStatus()).isNull();
                    assertThat(entry.getToStatus()).isEqualTo(OrderStatus.RECEBIDO);
                    assertThat(entry.getChangedBy().getId()).isEqualTo(userId);
                  });
        });
  }

  @Test
  void statusChangeBumpsVersionAndAppendsHistory() {
    long orderId = createOrder();
    int initialVersion = versionOf(orderId);

    tx.executeWithoutResult(
        status -> {
          Order order = orders.findById(orderId).orElseThrow();
          order.changeStatus(OrderStatus.EM_PREPARO, users.getReferenceById(userId));
        });

    assertThat(versionOf(orderId)).isEqualTo(initialVersion + 1);
    assertThat(
            jdbc.queryForList(
                "SELECT coalesce(from_status, '-') || '>' || to_status FROM order_status_history"
                    + " WHERE order_id = ? ORDER BY id",
                String.class,
                orderId))
        .containsExactly("->RECEBIDO", "RECEBIDO>EM_PREPARO");
  }

  @Test
  void orderKeepsTheOriginalAddressAfterItIsEdited() {
    long orderId = createOrder();

    long newAddressId =
        addressService
            .update(
                userId,
                addressId,
                new AddressRequest(
                    "Casa", "Rua Nova", "2", null, "Centro", "São Paulo", "SP", "01310100"))
            .getId();

    assertThat(newAddressId).isNotEqualTo(addressId);
    assertThat(
            jdbc.queryForObject("SELECT address_id FROM orders WHERE id = ?", Long.class, orderId))
        .isEqualTo(addressId);
    assertThat(
            jdbc.queryForObject(
                "SELECT a.street FROM orders o JOIN addresses a ON a.id = o.address_id WHERE o.id = ?",
                String.class,
                orderId))
        .isEqualTo("Avenida Paulista");
  }

  @Test
  void foreignKeysAreEnforced() {
    assertThatThrownBy(
            () ->
                jdbc.update(
                    """
                    INSERT INTO orders (customer_name, address_id, status, total_amount_cents,
                                        created_by, created_at, updated_at)
                    VALUES ('X', 999999, 'RECEBIDO', 100, ?, 0, 0)
                    """,
                    userId))
        // Plain JDBC: Spring has no SQLite error codes, so the exception is uncategorized.
        .hasMessageContaining("FOREIGN KEY constraint failed");
  }

  private long createOrder() {
    return tx.execute(
        status -> {
          User user = users.getReferenceById(userId);
          Order order =
              Order.create(
                  "Maria Silva",
                  addresses.findById(addressId).orElseThrow(),
                  List.of(
                      new OrderItem(product("x-burguer"), 2),
                      new OrderItem(product("refrigerante-lata"), 1)),
                  user);
          return orders.save(order).getId();
        });
  }

  private Product product(String slug) {
    return products.findById(TestProducts.idOf(jdbc, slug)).orElseThrow();
  }

  private int versionOf(long orderId) {
    return jdbc.queryForObject("SELECT version FROM orders WHERE id = ?", Integer.class, orderId);
  }
}
