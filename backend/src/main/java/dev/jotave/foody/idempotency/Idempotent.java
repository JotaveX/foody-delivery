package dev.jotave.foody.idempotency;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Makes an authenticated controller method honour the optional {@code Idempotency-Key} header (a
 * UUID): a retry with the same key and body replays the stored response instead of running the
 * method again. The method must return a {@code ResponseEntity}. See {@link IdempotencyAspect}.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Idempotent {}
