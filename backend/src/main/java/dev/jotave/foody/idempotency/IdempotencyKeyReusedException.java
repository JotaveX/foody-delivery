package dev.jotave.foody.idempotency;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** 422: the key was already used for a request with a different body. */
public class IdempotencyKeyReusedException extends ErrorResponseException {

  public IdempotencyKeyReusedException() {
    super(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Esta Idempotency-Key já foi usada em uma requisição com outro conteúdo."),
        null);
  }
}
