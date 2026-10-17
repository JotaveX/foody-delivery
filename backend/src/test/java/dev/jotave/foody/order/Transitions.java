package dev.jotave.foody.order;

import static dev.jotave.foody.order.OrderStatus.CANCELADO;
import static dev.jotave.foody.order.OrderStatus.EM_PREPARO;
import static dev.jotave.foody.order.OrderStatus.ENTREGUE;
import static dev.jotave.foody.order.OrderStatus.RECEBIDO;
import static dev.jotave.foody.order.OrderStatus.SAIU_PARA_ENTREGA;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.params.provider.Arguments;

/**
 * The expected state machine, written independently from {@link OrderStatus} so tests do not derive
 * expectations from the code under test.
 */
final class Transitions {

  static final Map<OrderStatus, Set<OrderStatus>> VALID =
      Map.of(
          RECEBIDO, Set.of(EM_PREPARO, CANCELADO),
          EM_PREPARO, Set.of(SAIU_PARA_ENTREGA, CANCELADO),
          SAIU_PARA_ENTREGA, Set.of(ENTREGUE),
          ENTREGUE, Set.of(),
          CANCELADO, Set.of());

  /** Shortest sequence of changes taking a new order (RECEBIDO) to each status. */
  static final Map<OrderStatus, List<OrderStatus>> PATH_TO =
      Map.of(
          RECEBIDO, List.of(),
          EM_PREPARO, List.of(EM_PREPARO),
          SAIU_PARA_ENTREGA, List.of(EM_PREPARO, SAIU_PARA_ENTREGA),
          ENTREGUE, List.of(EM_PREPARO, SAIU_PARA_ENTREGA, ENTREGUE),
          CANCELADO, List.of(CANCELADO));

  private Transitions() {}

  static Stream<Arguments> valid() {
    return allPairs().filter(pair -> VALID.get(pair[0]).contains(pair[1])).map(Arguments::of);
  }

  static Stream<Arguments> invalid() {
    return allPairs().filter(pair -> !VALID.get(pair[0]).contains(pair[1])).map(Arguments::of);
  }

  private static Stream<OrderStatus[]> allPairs() {
    return Arrays.stream(OrderStatus.values())
        .flatMap(
            from -> Arrays.stream(OrderStatus.values()).map(to -> new OrderStatus[] {from, to}));
  }
}
