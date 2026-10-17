package dev.jotave.foody.ratelimit;

import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.Bucket4jLettuce;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.resource.ClientResources;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.autoconfigure.data.redis.RedisConnectionDetails;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * Bucket4j needs a native Lettuce client; it is built from the same connection details as Spring
 * Data Redis (so Testcontainers' @ServiceConnection applies) and shares its ClientResources.
 */
@Configuration
class RateLimitConfig {

  @Bean(destroyMethod = "shutdown")
  RedisClient rateLimitRedisClient(RedisConnectionDetails details, ClientResources resources) {
    RedisConnectionDetails.Standalone standalone = details.getStandalone();
    RedisURI.Builder uri =
        RedisURI.builder()
            .withHost(standalone.getHost())
            .withPort(standalone.getPort())
            .withDatabase(standalone.getDatabase());
    if (StringUtils.hasText(details.getPassword())) {
      if (StringUtils.hasText(details.getUsername())) {
        uri.withAuthentication(details.getUsername(), details.getPassword());
      } else {
        uri.withPassword(details.getPassword().toCharArray());
      }
    }
    return RedisClient.create(resources, uri.build());
  }

  @Bean
  ProxyManager<String> rateLimitBuckets(RedisClient rateLimitRedisClient) {
    return Bucket4jLettuce.casBasedBuilder(rateLimitRedisClient)
        // Without a timeout a Redis outage would hang every request; the filter fails open.
        .requestTimeout(Duration.ofSeconds(1))
        // Idle buckets are full again once refilled, so Redis can drop them shortly after.
        .expirationAfterWrite(
            ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(
                Duration.ofSeconds(10)))
        .build()
        .withMapper(key -> key.getBytes(StandardCharsets.UTF_8));
  }

  @Bean
  ClientIpResolver clientIpResolver(RateLimitProperties properties) {
    return new ClientIpResolver(properties.trustedProxies());
  }
}
