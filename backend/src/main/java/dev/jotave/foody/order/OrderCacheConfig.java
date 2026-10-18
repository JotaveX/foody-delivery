package dev.jotave.foody.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

/**
 * Cache of {@code GET /orders/{id}}: the {@link OrderDetail} DTO as JSON, evicted after every
 * committed change by {@link OrderCacheEvictor}.
 *
 * <p>The paginated list is deliberately not cached: every page/size/status combination would be a
 * separate entry, and any order change would have to evict all of them (pattern scans or key
 * tracking in Redis), for a query that is already a cheap indexed read on SQLite.
 */
@Configuration
class OrderCacheConfig {

  static final String ORDER_DETAILS = "order-details";

  @Bean
  RedisCacheManagerBuilderCustomizer orderDetailsCache(
      RedisCacheConfiguration defaults, ObjectMapper objectMapper) {
    // Typed serializer, no polymorphic type info in the payload: only OrderDetail can come out.
    var serializer = new Jackson2JsonRedisSerializer<>(objectMapper.copy(), OrderDetail.class);
    return builder ->
        builder.withCacheConfiguration(
            ORDER_DETAILS,
            defaults.serializeValuesWith(SerializationPair.fromSerializer(serializer)));
  }
}
