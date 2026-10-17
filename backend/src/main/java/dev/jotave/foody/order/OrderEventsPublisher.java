package dev.jotave.foody.order;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Publishes every committed order change to the Redis channel {@value #CHANNEL}, from which {@link
 * OrderEventsRelay} on every instance forwards it to its own WebSocket clients.
 *
 * <p>We go through Redis instead of the local STOMP broker because, with more than one instance,
 * the client watching an order may be connected to a different instance than the one that handled
 * the change.
 */
@Component
class OrderEventsPublisher {

  static final String CHANNEL = "order-events";

  private static final Logger log = LoggerFactory.getLogger(OrderEventsPublisher.class);

  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;

  OrderEventsPublisher(StringRedisTemplate redis, ObjectMapper objectMapper) {
    this.redis = redis;
    this.objectMapper = objectMapper;
  }

  // AFTER_COMMIT: never announce a change that was rolled back.
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  void on(OrderChangedEvent event) {
    try {
      redis.convertAndSend(CHANNEL, objectMapper.writeValueAsString(event.order()));
    } catch (JsonProcessingException | RuntimeException e) {
      // The change is already committed; a lost live update must not turn the request into a 500.
      // Clients recover on their next refetch.
      log.warn("Failed to publish update of order {}", event.orderId(), e);
    }
  }
}
