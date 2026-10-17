package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

class OrderStatusTest {

  @Test
  void stateMachineHasFiveValidAndTwentyInvalidTransitions() {
    assertThat(Transitions.valid()).hasSize(5);
    assertThat(Transitions.invalid()).hasSize(20);
  }

  @ParameterizedTest(name = "{0} -> {1} is allowed")
  @MethodSource("dev.jotave.foody.order.Transitions#valid")
  void allowsValidTransitions(OrderStatus from, OrderStatus to) {
    assertThat(from.canTransitionTo(to)).isTrue();
  }

  @ParameterizedTest(name = "{0} -> {1} is rejected")
  @MethodSource("dev.jotave.foody.order.Transitions#invalid")
  void rejectsInvalidTransitions(OrderStatus from, OrderStatus to) {
    assertThat(from.canTransitionTo(to)).isFalse();
  }

  @ParameterizedTest
  @EnumSource(OrderStatus.class)
  void rejectsNullTarget(OrderStatus from) {
    assertThat(from.canTransitionTo(null)).isFalse();
  }

  @ParameterizedTest
  @EnumSource(
      value = OrderStatus.class,
      names = {"ENTREGUE", "CANCELADO"})
  void terminalStatusesHaveNoWayOut(OrderStatus terminal) {
    assertThat(terminal.isTerminal()).isTrue();
    assertThat(Arrays.stream(OrderStatus.values()).filter(terminal::canTransitionTo)).isEmpty();
  }

  @ParameterizedTest
  @EnumSource(
      value = OrderStatus.class,
      names = {"ENTREGUE", "CANCELADO"},
      mode = EnumSource.Mode.EXCLUDE)
  void nonTerminalStatusesAreNotTerminal(OrderStatus status) {
    assertThat(status.isTerminal()).isFalse();
  }
}
