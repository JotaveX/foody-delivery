package dev.jotave.foody.order;

import dev.jotave.foody.order.OrderResponses.OrderDetail;
import java.time.Instant;

/**
 * Published on every order state change (creation and status transitions), inside the transaction
 * that made it. Listeners that push data out (WebSocket, cache) should use
 * {@code @TransactionalEventListener(phase = AFTER_COMMIT)} so they never announce a rolled-back
 * change.
 *
 * @param previousStatus null when the order was just created
 * @param order snapshot of the order right after the change, mapped while still in the transaction
 */
public record OrderChangedEvent(
    long orderId,
    OrderStatus previousStatus,
    OrderStatus status,
    long changedBy,
    Instant occurredAt,
    OrderDetail order) {

  public boolean isCreation() {
    return previousStatus == null;
  }
}
