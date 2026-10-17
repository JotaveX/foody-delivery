package dev.jotave.foody.order;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

public class InvalidStatusTransitionException extends ErrorResponseException {

  private final OrderStatus from;
  private final OrderStatus to;

  public InvalidStatusTransitionException(OrderStatus from, OrderStatus to) {
    super(
        HttpStatus.CONFLICT,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "Não é possível alterar o status de %s para %s.".formatted(from, to)),
        null);
    this.from = from;
    this.to = to;
  }

  public OrderStatus getFrom() {
    return from;
  }

  public OrderStatus getTo() {
    return to;
  }
}
