package dev.jotave.foody.auth;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

/**
 * At most 72 bytes in UTF-8, the BCrypt input limit. {@code @Size} counts characters, and an
 * accented letter takes 2 bytes (an emoji 4), so a password within 72 characters can still make
 * {@code BCryptPasswordEncoder.encode} throw.
 */
@Documented
@Constraint(validatedBy = FitsBcrypt.Validator.class)
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface FitsBcrypt {

  int MAX_BYTES = 72;

  String message() default
      "A senha deve ter no máximo 72 bytes (letras acentuadas contam como 2, emojis como 4).";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};

  class Validator implements ConstraintValidator<FitsBcrypt, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
      return value == null || value.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }
  }
}
