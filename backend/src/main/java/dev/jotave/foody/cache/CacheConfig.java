package dev.jotave.foody.cache;

import java.time.Duration;
import org.apache.commons.logging.LogFactory;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.LoggingCacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

/**
 * Spring Cache backed by Redis (the {@code RedisCacheManager} is Boot's, built from the beans
 * below). Each cache registers its own configuration with a JSON serializer for its DTO through a
 * {@link RedisCacheManagerBuilderCustomizer} in its feature package; entities are never cached.
 */
// Higher precedence than the transaction interceptor (LOWEST_PRECEDENCE): a hit returns without
// opening a transaction, and a miss stores the value only after the read transaction has ended.
@EnableCaching(order = Ordered.LOWEST_PRECEDENCE - 1)
@Configuration
class CacheConfig implements CachingConfigurer {

  static final Duration TTL = Duration.ofMinutes(10);

  /** Defaults for every cache: keys are {@code cache:{cacheName}:{key}}. */
  @Bean
  RedisCacheConfiguration defaultRedisCacheConfiguration() {
    return RedisCacheConfiguration.defaultCacheConfig()
        .entryTtl(TTL)
        .disableCachingNullValues()
        .computePrefixWith(cacheName -> "cache:" + cacheName + ":");
  }

  @Bean
  RedisCacheManagerBuilderCustomizer onlyDeclaredCaches() {
    // A cache created on the fly would get the default JDK serializer; every cache must be declared
    // with its JSON configuration instead.
    return builder -> builder.disableCreateOnMissingCache();
  }

  /**
   * The cache is an optimization: if Redis is down (or an entry can't be deserialized), log and
   * carry on as a miss, so the request falls through to the database instead of failing.
   */
  @Override
  public CacheErrorHandler errorHandler() {
    return new LoggingCacheErrorHandler(LogFactory.getLog(CacheConfig.class), false);
  }
}
