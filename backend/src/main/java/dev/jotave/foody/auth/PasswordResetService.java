package dev.jotave.foody.auth;

import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Password reset by e-mail link. The token (256 random bits) only travels in the e-mail; Redis
 * keeps its SHA-256 under {@code pwreset:{hash}} with the user id and token version, so a Redis
 * dump does not hold usable links.
 *
 * <p>A token works once (GETDEL) and only while the user's token version is the one it was issued
 * for: resetting the password bumps the version, which revokes every JWT and every other pending
 * link at once.
 */
@Service
public class PasswordResetService {

  private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

  private static final String TOKEN_PREFIX = "pwreset:";
  private static final String COOLDOWN_PREFIX = "pwreset-cooldown:";
  private static final int TOKEN_BYTES = 32;

  private final UserRepository users;
  private final StringRedisTemplate redis;
  private final PasswordEncoder passwordEncoder;
  private final PasswordResetMailer mailer;
  private final PasswordResetProperties properties;
  private final SecureRandom random = new SecureRandom();

  public PasswordResetService(
      UserRepository users,
      StringRedisTemplate redis,
      PasswordEncoder passwordEncoder,
      PasswordResetMailer mailer,
      PasswordResetProperties properties) {
    this.users = users;
    this.redis = redis;
    this.passwordEncoder = passwordEncoder;
    this.mailer = mailer;
    this.properties = properties;
  }

  /**
   * Sends a reset link if the e-mail belongs to a user. Returns the same way either way, and the
   * e-mail goes out asynchronously, so neither the response nor its timing reveals whether the
   * account exists.
   */
  @Transactional(readOnly = true)
  public void requestReset(String email) {
    Optional<User> found = users.findByEmail(AuthService.normalizeEmail(email));
    if (found.isEmpty()) {
      return;
    }
    User user = found.get();
    // Caps the e-mails one person can trigger to someone else's inbox, whatever IPs they use.
    Boolean firstInCooldown =
        redis.opsForValue().setIfAbsent(COOLDOWN_PREFIX + user.getId(), "1", properties.cooldown());
    if (!Boolean.TRUE.equals(firstInCooldown)) {
      return;
    }

    String token = newToken();
    String tokenHash = sha256(token);
    redis
        .opsForValue()
        .set(
            TOKEN_PREFIX + tokenHash,
            user.getId() + ":" + user.getTokenVersion(),
            properties.ttl());
    String link =
        UriComponentsBuilder.fromUri(properties.url())
            .queryParam("token", token)
            .build()
            .toUriString();
    try {
      mailer.send(user.getEmail(), user.getName(), link, properties.ttl(), tokenHash);
    } catch (TaskRejectedException e) {
      // A 5xx only for existing accounts would reveal them; the user can ask again.
      log.error("Mail queue full; password reset e-mail dropped", e);
    }
  }

  @Transactional
  public void reset(String token, String newPassword) {
    String stored = redis.opsForValue().getAndDelete(TOKEN_PREFIX + sha256(token));
    if (stored == null) {
      throw new InvalidPasswordResetTokenException();
    }
    int separator = stored.indexOf(':');
    long userId = Long.parseLong(stored.substring(0, separator));
    int tokenVersion = Integer.parseInt(stored.substring(separator + 1));

    User user =
        users
            .findById(userId)
            .filter(u -> u.getTokenVersion() == tokenVersion)
            .orElseThrow(InvalidPasswordResetTokenException::new);
    user.changePassword(passwordEncoder.encode(newPassword));
  }

  private String newToken() {
    byte[] bytes = new byte[TOKEN_BYTES];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static String sha256(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
