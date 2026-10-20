package dev.jotave.foody.auth;

import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The refresh token's cookie: HttpOnly (out of reach of scripts, so XSS cannot take it), sent only
 * to {@code /auth} and only same-site ({@code SameSite=Strict}; the SPA on foody.jotave.dev and the
 * API on api.foody.jotave.dev are the same site). Proxies that serve the API under {@code /api}
 * rewrite the path (Vite, nginx).
 */
@Component
class RefreshTokenCookie {

  static final String NAME = "foody_refresh";
  private static final String PATH = "/auth";

  private final RefreshTokenProperties properties;

  RefreshTokenCookie(RefreshTokenProperties properties) {
    this.properties = properties;
  }

  ResponseCookie issue(String token) {
    return build(token, properties.ttl());
  }

  ResponseCookie clear() {
    return build("", Duration.ZERO);
  }

  private ResponseCookie build(String value, Duration maxAge) {
    return ResponseCookie.from(NAME, value)
        .httpOnly(true)
        .secure(properties.cookieSecure())
        .sameSite("Strict")
        .path(PATH)
        .maxAge(maxAge)
        .build();
  }
}
