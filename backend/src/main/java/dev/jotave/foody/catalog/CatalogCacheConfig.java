package dev.jotave.foody.catalog;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

/** Cache of {@code GET /products}: one entry per category plus {@code all}. */
@Configuration
class CatalogCacheConfig {

  static final String CATALOG = "catalog";
  static final Duration TTL = Duration.ofHours(1);

  @Bean
  RedisCacheManagerBuilderCustomizer catalogCache(
      RedisCacheConfiguration defaults, ObjectMapper objectMapper) {
    JavaType type =
        objectMapper.getTypeFactory().constructCollectionType(List.class, ProductResponse.class);
    var serializer = new Jackson2JsonRedisSerializer<>(objectMapper.copy(), type);
    return builder ->
        builder.withCacheConfiguration(
            CATALOG,
            defaults
                .entryTtl(TTL)
                .serializeValuesWith(SerializationPair.fromSerializer(serializer)));
  }
}
