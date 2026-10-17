package dev.jotave.foody.support;

import dev.jotave.foody.order.OrderChangedEvent;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Collects every {@link OrderChangedEvent} published in the test context. Spring's
 * {@code @RecordApplicationEvents} only sees events from the test thread, while ITs go through real
 * HTTP requests handled on server threads.
 */
@Component
public class RecordedOrderEvents {

  private final List<OrderChangedEvent> events = new CopyOnWriteArrayList<>();

  @EventListener
  void on(OrderChangedEvent event) {
    events.add(event);
  }

  public List<OrderChangedEvent> forOrder(long orderId) {
    return events.stream().filter(e -> e.orderId() == orderId).toList();
  }
}
