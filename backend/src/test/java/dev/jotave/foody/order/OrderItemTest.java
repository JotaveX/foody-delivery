package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class OrderItemTest {

  @ParameterizedTest
  @ValueSource(ints = {0, -1})
  void rejectsNonPositiveQuantity(int quantity) {
    assertThatThrownBy(() -> new OrderItem("Pizza", quantity, new BigDecimal("10.00"), null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"0", "0.00", "-0.01", "1.999"})
  void rejectsInvalidUnitPrice(String price) {
    assertThatThrownBy(() -> new OrderItem("Pizza", 1, new BigDecimal(price), null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"   "})
  void rejectsBlankName(String name) {
    assertThatThrownBy(() -> new OrderItem(name, 1, new BigDecimal("10.00"), null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsNullUnitPrice() {
    assertThatThrownBy(() -> new OrderItem("Pizza", 1, null, null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void normalizesPriceToCentsAndComputesSubtotal() {
    OrderItem item = new OrderItem(" Pizza ", 3, new BigDecimal("12.5"), null);

    assertThat(item.getName()).isEqualTo("Pizza");
    assertThat(item.getUnitPrice()).isEqualTo(new BigDecimal("12.50"));
    assertThat(item.subtotal()).isEqualTo(new BigDecimal("37.50"));
  }

  @Test
  void acceptsTrailingZerosBeyondTwoDecimals() {
    assertThat(new OrderItem("Pizza", 1, new BigDecimal("9.900"), null).getUnitPrice())
        .isEqualTo(new BigDecimal("9.90"));
  }
}
