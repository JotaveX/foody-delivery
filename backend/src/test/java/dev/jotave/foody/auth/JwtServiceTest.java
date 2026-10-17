package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

  private static final JwtProperties PROPERTIES =
      new JwtProperties("test-secret-test-secret-test-secret-0123", Duration.ofHours(2));

  private final JwtService jwt = new JwtService(PROPERTIES);

  @Test
  void issuedTokenRoundTripsUserIdAndTokenVersion() {
    JwtService.IssuedToken issued = jwt.issue(42L, 3);

    assertThat(issued.expiresInSeconds()).isEqualTo(7200);
    assertThat(jwt.parse(issued.token())).isEqualTo(new JwtService.TokenClaims(42L, 3));
  }

  @Test
  void tamperedTokenIsRejected() {
    String token = jwt.issue(42L, 0).token();
    String tampered = token.substring(0, token.length() - 2) + "xx";

    assertThatThrownBy(() -> jwt.parse(tampered)).isInstanceOf(JwtException.class);
  }

  @Test
  void tokenSignedWithAnotherKeyIsRejected() {
    var other =
        new JwtService(
            new JwtProperties("another-secret-another-secret-another-0123", Duration.ofHours(2)));

    assertThatThrownBy(() -> jwt.parse(other.issue(42L, 0).token()))
        .isInstanceOf(JwtException.class);
  }

  @Test
  void expiredTokenIsRejected() {
    Instant issuedAt = Instant.parse("2020-01-01T00:00:00Z");
    var past = new JwtService(PROPERTIES, Clock.fixed(issuedAt, ZoneOffset.UTC));

    assertThatThrownBy(() -> jwt.parse(past.issue(42L, 0).token()))
        .isInstanceOf(ExpiredJwtException.class);
  }

  @Test
  void shortSecretIsRefused() {
    assertThatThrownBy(() -> new JwtService(new JwtProperties("short", Duration.ofHours(1))))
        .isInstanceOf(IllegalStateException.class);
  }
}
