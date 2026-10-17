package dev.jotave.foody.order;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

public class InvalidStatusTransitionException extends ErrorResponseException {

  private final OrderStatus from;
  private final OrderStatus to;

  public InvalidStatusTransitionException(OrderStatus from, OrderStatus to) {
    super(HttpStatus.CONFLICT, problem(from, to), null);
    this.from = from;
    this.to = to;
  }

  private static ProblemDetail problem(OrderStatus from, OrderStatus to) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "Não é possível alterar o status de %s para %s.".formatted(from, to));
    problem.setProperty("currentStatus", from);
    problem.setProperty("requestedStatus", to);
    return problem;
  }

  public OrderStatus getFrom() {
    return from;
  }

  public OrderStatus getTo() {
    return to;
  }
}
