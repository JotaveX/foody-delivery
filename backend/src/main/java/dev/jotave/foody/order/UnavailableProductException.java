package dev.jotave.foody.order;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** 422: the request is well-formed but some products don't exist or are no longer sold. */
public class UnavailableProductException extends ErrorResponseException {

  public UnavailableProductException(List<Long> productIds) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, problem(productIds), null);
  }

  private static ProblemDetail problem(List<Long> productIds) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Há produtos indisponíveis no pedido. Atualize o cardápio e tente novamente.");
    problem.setProperty("productIds", productIds);
    problem.setProperty("errors", Map.of("items", "Produto indisponível."));
    return problem;
  }
}
