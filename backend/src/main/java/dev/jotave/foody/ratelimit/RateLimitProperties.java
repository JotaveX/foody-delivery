package dev.jotave.foody.ratelimit;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Rate limits, all enforced with token buckets stored in Redis.
 *
 * @param enabled turns every limit off when false
 * @param trustedProxies IPs or CIDRs of reverse proxies whose X-Forwarded-For is honoured; see
 *     {@link ClientIpResolver}
 * @param perIp limits keyed by client IP for specific public paths (the map key names the bucket)
 * @param perUser general limit for every authenticated request, keyed by user id
 */
@ConfigurationProperties("app.rate-limit")
public record RateLimitProperties(
    boolean enabled, List<String> trustedProxies, Map<String, PathLimit> perIp, Limit perUser) {

  public RateLimitProperties {
    trustedProxies =
        trustedProxies == null
            ? List.of()
            : trustedProxies.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
    perIp = perIp == null ? Map.of() : Map.copyOf(perIp);
  }

  /** {@code capacity} requests per {@code period}, refilled gradually. */
  public record Limit(long capacity, Duration period) {}

  /** A {@link Limit} applied to requests whose path is exactly {@code path}. */
  public record PathLimit(String path, long capacity, Duration period) {
    public Limit limit() {
      return new Limit(capacity, period);
    }
  }
}
