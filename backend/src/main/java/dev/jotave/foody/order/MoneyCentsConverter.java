package dev.jotave.foody.order;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.math.BigDecimal;

/** Stores BigDecimal amounts (2 decimal places) as integer cents. */
@Converter
public class MoneyCentsConverter implements AttributeConverter<BigDecimal, Long> {

  private static final int SCALE = 2;

  @Override
  public Long convertToDatabaseColumn(BigDecimal amount) {
    // longValueExact fails loudly instead of silently dropping fractions of a cent.
    return amount == null ? null : amount.movePointRight(SCALE).longValueExact();
  }

  @Override
  public BigDecimal convertToEntityAttribute(Long cents) {
    return cents == null ? null : BigDecimal.valueOf(cents, SCALE);
  }
}
