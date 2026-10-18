package dev.jotave.foody.order;

import static dev.jotave.foody.order.OrderStatus.CANCELADO;
import static dev.jotave.foody.order.OrderStatus.EM_PREPARO;
import static dev.jotave.foody.order.OrderStatus.ENTREGUE;
import static dev.jotave.foody.order.OrderStatus.RECEBIDO;
import static dev.jotave.foody.order.OrderStatus.SAIU_PARA_ENTREGA;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import dev.jotave.foody.address.Address;
import dev.jotave.foody.catalog.Product;
import dev.jotave.foody.catalog.ProductCategory;
import dev.jotave.foody.user.User;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.util.ReflectionTestUtils;

class OrderTest {

  private final User customer = new User("Maria", "maria@example.com", "hash");
  private final User operator = new User("Operador", "op@example.com", "hash");
  private final Product burger = product("x-burguer", "12.50");
  private final Product soda = product("refrigerante-lata", "8.90");
  private final Address address =
      new Address(
          customer, "Casa", "Rua A", "1", null, "Centro", "Campinas", "SP", "13010000", true);

  @Test
  void createStartsAsRecebidoWithInitialHistoryEntry() {
    Order order = newOrder();

    assertThat(order.getStatus()).isEqualTo(RECEBIDO);
    assertThat(order.getCustomerName()).isEqualTo("Maria Silva");
    assertThat(order.getDeliveryAddress()).isSameAs(address);
    assertThat(order.getCreatedBy()).isSameAs(customer);
    assertThat(order.getUpdatedAt()).isEqualTo(order.getCreatedAt());
    assertThat(order.getStatusHistory())
        .singleElement()
        .satisfies(
            entry -> {
              assertThat(entry.getFromStatus()).isNull();
              assertThat(entry.getToStatus()).isEqualTo(RECEBIDO);
              assertThat(entry.getChangedBy()).isSameAs(customer);
              assertThat(entry.getChangedAt()).isEqualTo(order.getCreatedAt());
              assertThat(entry.getOrder()).isSameAs(order);
            });
  }

  @Test
  void totalIsTheSumOfItemSubtotals() {
    Order order = newOrder();

    assertThat(order.getTotalAmount()).isEqualByComparingTo("33.90");
    assertThat(order.getTotalAmount().scale()).isEqualTo(2);
    assertThat(order.getItems()).allSatisfy(item -> assertThat(item.getOrder()).isSameAs(order));
  }

  @Test
  void totalUsesThePriceSnapshotTakenAtCreation() {
    Order order = newOrder();

    ReflectionTestUtils.setField(burger, "price", new BigDecimal("30.00"));

    assertThat(order.getTotalAmount()).isEqualByComparingTo("33.90");
    assertThat(order.getItems())
        .extracting(OrderItem::getUnitPrice)
        .containsExactly(new BigDecimal("12.50"), new BigDecimal("8.90"));
  }

  @ParameterizedTest(name = "{0} -> {1}")
  @MethodSource("dev.jotave.foody.order.Transitions#valid")
  void validTransitionChangesStatusAndRecordsHistory(OrderStatus from, OrderStatus to) {
    Order order = orderIn(from);
    int historySize = order.getStatusHistory().size();

    order.changeStatus(to, operator);

    assertThat(order.getStatus()).isEqualTo(to);
    assertThat(order.getStatusHistory()).hasSize(historySize + 1);
    OrderStatusHistory last = order.getStatusHistory().getLast();
    assertThat(last.getFromStatus()).isEqualTo(from);
    assertThat(last.getToStatus()).isEqualTo(to);
    assertThat(last.getChangedBy()).isSameAs(operator);
    assertThat(last.getChangedAt()).isEqualTo(order.getUpdatedAt());
    assertThat(order.getUpdatedAt()).isAfterOrEqualTo(order.getCreatedAt());
  }

  @ParameterizedTest(name = "{0} -> {1}")
  @MethodSource("dev.jotave.foody.order.Transitions#invalid")
  void invalidTransitionThrowsAndLeavesTheOrderUntouched(OrderStatus from, OrderStatus to) {
    Order order = orderIn(from);
    List<OrderStatusHistory> historyBefore = List.copyOf(order.getStatusHistory());
    var updatedAtBefore = order.getUpdatedAt();

    assertThatThrownBy(() -> order.changeStatus(to, operator))
        .isInstanceOfSatisfying(
            InvalidStatusTransitionException.class,
            e -> {
              assertThat(e.getFrom()).isEqualTo(from);
              assertThat(e.getTo()).isEqualTo(to);
              assertThat(e.getStatusCode().value()).isEqualTo(409);
              assertThat(e.getBody().getDetail())
                  .isEqualTo("Não é possível alterar o status de %s para %s.", from, to);
            });
    assertThat(order.getStatus()).isEqualTo(from);
    assertThat(order.getStatusHistory()).containsExactlyElementsOf(historyBefore);
    assertThat(order.getUpdatedAt()).isEqualTo(updatedAtBefore);
  }

  @Test
  void fullLifecycleRecordsEveryStepInOrder() {
    Order order = newOrder();

    order.changeStatus(EM_PREPARO, operator);
    order.changeStatus(SAIU_PARA_ENTREGA, operator);
    order.changeStatus(ENTREGUE, operator);

    assertThat(order.getStatusHistory())
        .extracting(
            OrderStatusHistory::getFromStatus,
            OrderStatusHistory::getToStatus,
            OrderStatusHistory::getChangedBy)
        .containsExactly(
            tuple(null, RECEBIDO, customer),
            tuple(RECEBIDO, EM_PREPARO, operator),
            tuple(EM_PREPARO, SAIU_PARA_ENTREGA, operator),
            tuple(SAIU_PARA_ENTREGA, ENTREGUE, operator));
  }

  @Test
  void cancellationIsRecorded() {
    Order order = newOrder();

    order.changeStatus(CANCELADO, operator);

    assertThat(order.getStatus()).isEqualTo(CANCELADO);
    assertThat(order.getStatusHistory().getLast())
        .extracting(OrderStatusHistory::getFromStatus, OrderStatusHistory::getToStatus)
        .containsExactly(RECEBIDO, CANCELADO);
  }

  @Test
  void createRequiresItems() {
    assertThatThrownBy(() -> Order.create("Maria", address, List.of(), customer))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void createRequiresAnActiveAddress() {
    address.softDelete();

    assertThatThrownBy(() -> newOrder()).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void createRequiresACustomerName() {
    assertThatThrownBy(() -> Order.create("  ", address, items(), customer))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void collectionsAreReadOnly() {
    Order order = newOrder();

    assertThatThrownBy(() -> order.getItems().clear())
        .isInstanceOf(UnsupportedOperationException.class);
    assertThatThrownBy(() -> order.getStatusHistory().clear())
        .isInstanceOf(UnsupportedOperationException.class);
  }

  private Order orderIn(OrderStatus status) {
    Order order = newOrder();
    Transitions.PATH_TO.get(status).forEach(step -> order.changeStatus(step, operator));
    assertThat(order.getStatus()).isEqualTo(status);
    return order;
  }

  private Order newOrder() {
    return Order.create(" Maria Silva ", address, items(), customer);
  }

  private List<OrderItem> items() {
    return List.of(new OrderItem(burger, 2), new OrderItem(soda, 1));
  }

  private static Product product(String slug, String price) {
    return new Product(
        slug,
        slug,
        "",
        ProductCategory.LANCHES,
        new BigDecimal(price),
        "catalog/" + slug + ".webp");
  }
}
