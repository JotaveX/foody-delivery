package dev.jotave.foody.order;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Exactly one of {@code addressId} / {@code newAddress}; {@code saveAsDefault} needs the latter.
 */
@Documented
@Constraint(validatedBy = ExactlyOneDeliveryAddress.Validator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ExactlyOneDeliveryAddress {

  String message() default "Informe exatamente um entre addressId e newAddress.";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  class Validator implements ConstraintValidator<ExactlyOneDeliveryAddress, CreateOrderRequest> {

    @Override
    public boolean isValid(CreateOrderRequest request, ConstraintValidatorContext context) {
      if (request == null) {
        return true;
      }
      boolean hasId = request.addressId() != null;
      boolean hasNew = request.newAddress() != null;
      context.disableDefaultConstraintViolation();
      if (hasId == hasNew) {
        // Reported on a field so it shows up in the per-field "errors" map.
        context
            .buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
            .addPropertyNode("addressId")
            .addConstraintViolation();
        return false;
      }
      if (request.shouldSaveAsDefault() && !hasNew) {
        context
            .buildConstraintViolationWithTemplate("saveAsDefault só pode ser usado com newAddress.")
            .addPropertyNode("saveAsDefault")
            .addConstraintViolation();
        return false;
      }
      return true;
    }
  }
}
