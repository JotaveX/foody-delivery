package dev.jotave.foody.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Issues and verifies HS256 JWTs carrying the user id (sub) and its token version (tv). */
@Service
public class JwtService {

  static final String TOKEN_VERSION_CLAIM = "tv";

  private final SecretKey key;
  private final Duration expiration;
  private final Clock clock;

  @Autowired
  public JwtService(JwtProperties properties) {
    this(properties, Clock.systemUTC());
  }

  JwtService(JwtProperties properties, Clock clock) {
    byte[] secret = properties.secret().getBytes(StandardCharsets.UTF_8);
    if (secret.length < 32) {
      throw new IllegalStateException("app.jwt.secret must be at least 32 bytes (256 bits)");
    }
    this.key = Keys.hmacShaKeyFor(secret);
    this.expiration = properties.expiration();
    this.clock = clock;
  }

  public IssuedToken issue(long userId, int tokenVersion) {
    Instant now = clock.instant();
    String token =
        Jwts.builder()
            .subject(Long.toString(userId))
            .claim(TOKEN_VERSION_CLAIM, tokenVersion)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(expiration)))
            .signWith(key)
            .compact();
    return new IssuedToken(token, expiration.toSeconds());
  }

  /**
   * Verifies signature and expiration.
   *
   * @throws JwtException if the token is malformed, tampered with or expired
   */
  public TokenClaims parse(String token) {
    Claims claims =
        Jwts.parser()
            .verifyWith(key)
            .clock(() -> Date.from(clock.instant()))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    Integer tokenVersion = claims.get(TOKEN_VERSION_CLAIM, Integer.class);
    if (claims.getSubject() == null || tokenVersion == null) {
      throw new MalformedClaimsException();
    }
    try {
      return new TokenClaims(Long.parseLong(claims.getSubject()), tokenVersion);
    } catch (NumberFormatException e) {
      throw new MalformedClaimsException();
    }
  }

  public record IssuedToken(String token, long expiresInSeconds) {}

  public record TokenClaims(long userId, int tokenVersion) {}

  static class MalformedClaimsException extends JwtException {
    MalformedClaimsException() {
      super("Token is missing required claims");
    }
  }
}
