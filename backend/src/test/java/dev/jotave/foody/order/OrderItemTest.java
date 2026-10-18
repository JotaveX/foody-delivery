package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jotave.foody.catalog.Product;
import dev.jotave.foody.catalog.ProductCategory;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

class OrderItemTest {

  private final Product pizza =
      new Product(
          "pizza-calabresa",
          "Pizza de Calabresa",
          "Grande",
          ProductCategory.PIZZA,
          new BigDecimal("54.90"),
          "catalog/pizza-calabresa.webp");

  @ParameterizedTest
  @ValueSource(ints = {0, -1, OrderItem.MAX_QUANTITY + 1})
  void rejectsQuantityOutOfRange(int quantity) {
    assertThatThrownBy(() -> new OrderItem(pizza, quantity))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsMissingProduct() {
    assertThatThrownBy(() -> new OrderItem(null, 1)).isInstanceOf(NullPointerException.class);
  }

  @Test
  void copiesTheProductPriceAndComputesSubtotal() {
    OrderItem item = new OrderItem(pizza, 3);

    assertThat(item.getProduct()).isSameAs(pizza);
    assertThat(item.getUnitPrice()).isEqualTo(new BigDecimal("54.90"));
    assertThat(item.subtotal()).isEqualTo(new BigDecimal("164.70"));
  }

  @Test
  void laterPriceChangesDoNotAffectTheItem() {
    OrderItem item = new OrderItem(pizza, 2);

    ReflectionTestUtils.setField(pizza, "price", new BigDecimal("99.90"));

    assertThat(item.getUnitPrice()).isEqualTo(new BigDecimal("54.90"));
    assertThat(item.subtotal()).isEqualTo(new BigDecimal("109.80"));
  }
}
