package dev.jotave.foody.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Receives order updates from Redis (published by any instance, this one included) and forwards
 * them to the STOMP clients connected here, on {@code /topic/orders} and {@code
 * /topic/orders/{id}}.
 */
@Component
class OrderEventsRelay implements MessageListener {

  static final String ALL_ORDERS_TOPIC = "/topic/orders";

  private static final Logger log = LoggerFactory.getLogger(OrderEventsRelay.class);

  private final SimpMessagingTemplate messaging;
  private final ObjectMapper objectMapper;

  OrderEventsRelay(SimpMessagingTemplate messaging, ObjectMapper objectMapper) {
    this.messaging = messaging;
    this.objectMapper = objectMapper;
  }

  @Override
  public void onMessage(Message message, byte[] pattern) {
    OrderDetail order;
    try {
      order = objectMapper.readValue(message.getBody(), OrderDetail.class);
    } catch (IOException e) {
      log.warn("Discarding malformed message on {}", OrderEventsPublisher.CHANNEL, e);
      return;
    }
    messaging.convertAndSend(ALL_ORDERS_TOPIC, order);
    messaging.convertAndSend(ALL_ORDERS_TOPIC + "/" + order.id(), order);
  }
}
