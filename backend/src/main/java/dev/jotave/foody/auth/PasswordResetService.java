package dev.jotave.foody.auth;

import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
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

  private final UserRepository users;
  private final StringRedisTemplate redis;
  private final PasswordEncoder passwordEncoder;
  private final PasswordResetMailer mailer;
  private final PasswordResetProperties properties;
  private final TaskExecutor mailExecutor;

  public PasswordResetService(
      UserRepository users,
      StringRedisTemplate redis,
      PasswordEncoder passwordEncoder,
      PasswordResetMailer mailer,
      PasswordResetProperties properties,
      @Qualifier("mailExecutor") TaskExecutor mailExecutor) {
    this.users = users;
    this.redis = redis;
    this.passwordEncoder = passwordEncoder;
    this.mailer = mailer;
    this.properties = properties;
    this.mailExecutor = mailExecutor;
  }

  /**
   * Sends a reset link if the e-mail belongs to a user. Everything, the account lookup included,
   * runs on {@code mailExecutor}: the request thread does the same work for every e-mail, so
   * neither the response nor its timing reveals whether the account exists.
   */
  public void requestReset(String email) {
    try {
      mailExecutor.execute(() -> sendResetLink(email));
    } catch (TaskRejectedException e) {
      // Same answer either way; the user can ask again.
      log.error("Mail queue full; password reset request dropped", e);
    }
  }

  void sendResetLink(String email) {
    try {
      Optional<User> found = users.findByEmail(AuthService.normalizeEmail(email));
      if (found.isEmpty()) {
        return;
      }
      User user = found.get();
      // Caps the e-mails one person can trigger to someone else's inbox, whatever IPs they use.
      Boolean firstInCooldown =
          redis
              .opsForValue()
              .setIfAbsent(COOLDOWN_PREFIX + user.getId(), "1", properties.cooldown());
      if (!Boolean.TRUE.equals(firstInCooldown)) {
        return;
      }

      String token = OpaqueTokens.generate();
      String tokenHash = OpaqueTokens.sha256(token);
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
      mailer.send(user.getEmail(), user.getName(), link, properties.ttl(), tokenHash);
    } catch (RuntimeException e) {
      // Nobody is waiting on this thread (e.g. Redis or the database is down).
      log.error("Could not process a password reset request", e);
    }
  }

  @Transactional
  public void reset(String token, String newPassword) {
    String stored = redis.opsForValue().getAndDelete(TOKEN_PREFIX + OpaqueTokens.sha256(token));
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
}
