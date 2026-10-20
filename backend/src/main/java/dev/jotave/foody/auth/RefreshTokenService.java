package dev.jotave.foody.auth;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Rotating refresh tokens. The token (256 random bits) only travels in the HttpOnly cookie; Redis
 * keys everything by its SHA-256:
 *
 * <ul>
 *   <li>{@code refresh:{hash}} → {@code userId:tokenVersion:family}, the live token;
 *   <li>{@code refresh-family:{family}} → hash of the family's live token. A family is one login;
 *       deleting this key revokes it, whatever token of it is presented later;
 *   <li>{@code refresh-used:{hash}} → family, a token already rotated away.
 * </ul>
 *
 * <p>Each token works once (GETDEL) and is replaced by a new one of the same family. Presenting a
 * used token again means it leaked (or a response was lost): the whole family is revoked, so
 * whoever holds the newer token has to log in again too.
 *
 * <p>The token version is checked by the caller against the user, so a password change revokes
 * refresh tokens just like JWTs.
 */
@Service
public class RefreshTokenService {

  private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

  private static final String TOKEN_PREFIX = "refresh:";
  private static final String FAMILY_PREFIX = "refresh-family:";
  private static final String USED_PREFIX = "refresh-used:";

  private final StringRedisTemplate redis;
  private final Duration ttl;

  public RefreshTokenService(StringRedisTemplate redis, RefreshTokenProperties properties) {
    this.redis = redis;
    this.ttl = properties.ttl();
  }

  public Duration ttl() {
    return ttl;
  }

  /** Starts a new family (a login). */
  public String issue(long userId, int tokenVersion) {
    return issue(userId, tokenVersion, UUID.randomUUID().toString());
  }

  /** The next token of a family, after {@link #consume}. */
  public String issue(long userId, int tokenVersion, String family) {
    String token = OpaqueTokens.generate();
    String hash = OpaqueTokens.sha256(token);
    var values = redis.opsForValue();
    values.set(TOKEN_PREFIX + hash, userId + ":" + tokenVersion + ":" + family, ttl);
    values.set(FAMILY_PREFIX + family, hash, ttl);
    return token;
  }

  /**
   * Spends a token. Empty if it is unknown, expired, already used (which revokes its family) or of
   * a revoked family.
   */
  public Optional<TokenOwner> consume(String token) {
    String hash = OpaqueTokens.sha256(token);
    var values = redis.opsForValue();
    String stored = values.getAndDelete(TOKEN_PREFIX + hash);
    if (stored == null) {
      String family = values.get(USED_PREFIX + hash);
      if (family != null) {
        log.warn("Refresh token reused; revoking its family");
        redis.delete(FAMILY_PREFIX + family);
      }
      return Optional.empty();
    }
    TokenOwner owner = TokenOwner.parse(stored);
    if (!hash.equals(values.get(FAMILY_PREFIX + owner.family()))) {
      return Optional.empty();
    }
    values.set(USED_PREFIX + hash, owner.family(), ttl);
    return Optional.of(owner);
  }

  /** Logout: the token and its whole family stop working. */
  public void revoke(String token) {
    String stored = redis.opsForValue().getAndDelete(TOKEN_PREFIX + OpaqueTokens.sha256(token));
    if (stored != null) {
      redis.delete(FAMILY_PREFIX + TokenOwner.parse(stored).family());
    }
  }

  public record TokenOwner(long userId, int tokenVersion, String family) {

    static TokenOwner parse(String stored) {
      String[] parts = stored.split(":", 3);
      return new TokenOwner(Long.parseLong(parts[0]), Integer.parseInt(parts[1]), parts[2]);
    }
  }
}
