package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class MoneyCentsConverterTest {

  private final MoneyCentsConverter converter = new MoneyCentsConverter();

  @ParameterizedTest
  @CsvSource({"0.01, 1", "19.99, 1999", "33.90, 3390", "1000, 100000"})
  void roundTripsExactly(String amount, long cents) {
    assertThat(converter.convertToDatabaseColumn(new BigDecimal(amount))).isEqualTo(cents);
    assertThat(converter.convertToEntityAttribute(cents)).isEqualByComparingTo(amount);
    assertThat(converter.convertToEntityAttribute(cents).scale()).isEqualTo(2);
  }

  @Test
  void refusesFractionsOfACent() {
    assertThatThrownBy(() -> converter.convertToDatabaseColumn(new BigDecimal("0.001")))
        .isInstanceOf(ArithmeticException.class);
  }

  @Test
  void passesNullsThrough() {
    assertThat(converter.convertToDatabaseColumn(null)).isNull();
    assertThat(converter.convertToEntityAttribute(null)).isNull();
  }
}
