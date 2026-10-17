package dev.jotave.foody.idempotency;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/** Idempotency records in Redis: one JSON value per {@code idem:{userId}:{key}}. */
@Component
class IdempotencyStore {

  enum State {
    IN_PROGRESS,
    COMPLETED
  }

  record StoredResponse(int status, Map<String, String> headers, String body) {}

  record Entry(State state, String requestHash, StoredResponse response) {}

  private static final int MAX_RESERVE_ATTEMPTS = 3;

  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;
  private final IdempotencyProperties properties;

  IdempotencyStore(
      StringRedisTemplate redis, ObjectMapper objectMapper, IdempotencyProperties properties) {
    this.redis = redis;
    this.objectMapper = objectMapper;
    this.properties = properties;
  }

  /**
   * Atomically claims the key (SET NX) as IN_PROGRESS for this request hash.
   *
   * @return empty when the claim succeeded, otherwise the entry already stored under the key
   */
  Optional<Entry> reserve(String key, String requestHash) {
    String claim = write(new Entry(State.IN_PROGRESS, requestHash, null));
    for (int attempt = 0; attempt < MAX_RESERVE_ATTEMPTS; attempt++) {
      if (Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, claim, properties.ttl()))) {
        return Optional.empty();
      }
      String existing = redis.opsForValue().get(key);
      if (existing != null) {
        return Optional.of(read(existing));
      }
      // Released (failed request) or expired between SET NX and GET: claim it again.
    }
    throw new IdempotentRequestInProgressException();
  }

  void complete(String key, String requestHash, StoredResponse response) {
    redis
        .opsForValue()
        .set(key, write(new Entry(State.COMPLETED, requestHash, response)), properties.ttl());
  }

  void release(String key) {
    redis.delete(key);
  }

  private String write(Entry entry) {
    try {
      return objectMapper.writeValueAsString(entry);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Cannot serialize idempotency entry", e);
    }
  }

  private Entry read(String json) {
    try {
      return objectMapper.readValue(json, Entry.class);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Corrupt idempotency entry", e);
    }
  }
}
