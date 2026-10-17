package dev.jotave.foody.order;

import java.util.EnumSet;
import java.util.Set;

/**
 * Order lifecycle:
 *
 * <pre>
 * RECEBIDO -> EM_PREPARO -> SAIU_PARA_ENTREGA -> ENTREGUE
 *     \            \
 *      +-----------+--> CANCELADO
 * </pre>
 *
 * ENTREGUE and CANCELADO are terminal.
 */
public enum OrderStatus {
  RECEBIDO,
  EM_PREPARO,
  SAIU_PARA_ENTREGA,
  ENTREGUE,
  CANCELADO;

  public boolean canTransitionTo(OrderStatus next) {
    return next != null && allowedNext().contains(next);
  }

  public boolean isTerminal() {
    return allowedNext().isEmpty();
  }

  private Set<OrderStatus> allowedNext() {
    return switch (this) {
      case RECEBIDO -> EnumSet.of(EM_PREPARO, CANCELADO);
      case EM_PREPARO -> EnumSet.of(SAIU_PARA_ENTREGA, CANCELADO);
      case SAIU_PARA_ENTREGA -> EnumSet.of(ENTREGUE);
      case ENTREGUE, CANCELADO -> EnumSet.noneOf(OrderStatus.class);
    };
  }
}
