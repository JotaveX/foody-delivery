package dev.jotave.foody.order;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * 422: the request is well-formed but the addressId does not point to an active address of the
 * current user (another user's and deleted addresses look the same, revealing nothing).
 */
public class UnusableDeliveryAddressException extends ErrorResponseException {

  public UnusableDeliveryAddressException() {
    super(HttpStatus.UNPROCESSABLE_ENTITY, problem(), null);
  }

  private static ProblemDetail problem() {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Endereço de entrega inválido: use um endereço ativo do seu perfil.");
    problem.setProperty("errors", java.util.Map.of("addressId", "Endereço não encontrado."));
    return problem;
  }
}
