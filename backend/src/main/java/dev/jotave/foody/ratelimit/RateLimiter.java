package dev.jotave.foody.ratelimit;

import dev.jotave.foody.ratelimit.RateLimitProperties.Limit;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.EstimationProbe;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import org.springframework.stereotype.Component;

/** Takes one token from a Redis-backed bucket; buckets are shared by every API instance. */
@Component
public class RateLimiter {

  private final ProxyManager<String> buckets;

  public RateLimiter(ProxyManager<String> buckets) {
    this.buckets = buckets;
  }

  /**
   * @param name bucket family, e.g. {@code login} or {@code user}
   * @param subject who is limited, e.g. a client IP or a user id
   */
  public ConsumptionProbe tryConsume(String name, String subject, Limit limit) {
    return bucket(name, subject, limit).tryConsumeAndReturnRemaining(1);
  }

  /** Whether one more token could be taken now, without taking it. */
  public EstimationProbe estimate(String name, String subject, Limit limit) {
    return bucket(name, subject, limit).estimateAbilityToConsume(1);
  }

  private BucketProxy bucket(String name, String subject, Limit limit) {
    // The limit is part of the key, so changing it in application.yml takes effect at once
    // instead of reusing buckets created with the old configuration.
    String key =
        "rl:%s:%d:%d:%s".formatted(name, limit.capacity(), limit.period().toSeconds(), subject);
    BucketConfiguration configuration =
        BucketConfiguration.builder()
            .addLimit(
                l -> l.capacity(limit.capacity()).refillGreedy(limit.capacity(), limit.period()))
            .build();
    return buckets.getProxy(key, () -> configuration);
  }
}
