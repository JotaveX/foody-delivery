package dev.jotave.foody.idempotency;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** 409: the first request with this key is still running; the client should retry shortly. */
public class IdempotentRequestInProgressException extends ErrorResponseException {

  public IdempotentRequestInProgressException() {
    super(
        HttpStatus.CONFLICT,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "Uma requisição com esta Idempotency-Key ainda está em processamento. Tente novamente"
                + " em instantes."),
        null);
  }
}
