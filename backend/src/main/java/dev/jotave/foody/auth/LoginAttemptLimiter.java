package dev.jotave.foody.auth;

import dev.jotave.foody.ratelimit.RateLimitProperties;
import dev.jotave.foody.ratelimit.RateLimitProperties.Limit;
import dev.jotave.foody.ratelimit.RateLimiter;
import io.github.bucket4j.EstimationProbe;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Caps failed logins per e-mail ({@code app.rate-limit.login-failures-per-account}), whatever IPs
 * they come from. Only failures take a token, so a user who logs in often is never limited. The
 * bucket is keyed by the SHA-256 of the normalized e-mail (no addresses in Redis) and exists for
 * unknown e-mails too, so being limited reveals nothing about the account.
 *
 * <p>Like the HTTP rate limit, it fails open when Redis is unavailable.
 */
@Component
class LoginAttemptLimiter {

  private static final Logger log = LoggerFactory.getLogger(LoginAttemptLimiter.class);
  private static final String BUCKET = "login-account";

  private final RateLimiter rateLimiter;
  private final RateLimitProperties properties;

  LoginAttemptLimiter(RateLimiter rateLimiter, RateLimitProperties properties) {
    this.rateLimiter = rateLimiter;
    this.properties = properties;
  }

  /**
   * @throws TooManyLoginAttemptsException if this e-mail has no failed attempts left
   */
  void checkAllowed(String normalizedEmail) {
    Limit limit = limit();
    if (limit == null) {
      return;
    }
    try {
      EstimationProbe probe = rateLimiter.estimate(BUCKET, subject(normalizedEmail), limit);
      if (!probe.canBeConsumed()) {
        throw new TooManyLoginAttemptsException(
            Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1));
      }
    } catch (TooManyLoginAttemptsException e) {
      throw e;
    } catch (RuntimeException e) {
      log.warn("Login attempt limit skipped: bucket store unavailable", e);
    }
  }

  void recordFailure(String normalizedEmail) {
    Limit limit = limit();
    if (limit == null) {
      return;
    }
    try {
      rateLimiter.tryConsume(BUCKET, subject(normalizedEmail), limit);
    } catch (RuntimeException e) {
      log.warn("Login attempt limit skipped: bucket store unavailable", e);
    }
  }

  private Limit limit() {
    return properties.enabled() ? properties.loginFailuresPerAccount() : null;
  }

  private static String subject(String normalizedEmail) {
    return OpaqueTokens.sha256(normalizedEmail);
  }
}
