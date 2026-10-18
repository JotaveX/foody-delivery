package dev.jotave.foody.order;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Evicts the cached {@code OrderDetail} once a change is committed. Evicting here instead of in
 * {@link OrderService} means a transaction that fails after the eviction can't leave a window where
 * a concurrent read caches the not-yet-committed (or never-committed) state.
 */
@Component
class OrderCacheEvictor {

  // Creations are skipped: nothing can be cached for an id that didn't exist.
  @TransactionalEventListener(
      phase = TransactionPhase.AFTER_COMMIT,
      condition = "!#event.isCreation()")
  @CacheEvict(cacheNames = OrderCacheConfig.ORDER_DETAILS, key = "#event.orderId()")
  public void on(OrderChangedEvent event) {
    // The eviction is done by @CacheEvict, so Redis failures go through the CacheErrorHandler.
  }
}
