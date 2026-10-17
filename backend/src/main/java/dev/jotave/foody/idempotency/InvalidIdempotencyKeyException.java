package dev.jotave.foody.idempotency;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

public class InvalidIdempotencyKeyException extends ErrorResponseException {

  public InvalidIdempotencyKeyException() {
    super(
        HttpStatus.BAD_REQUEST,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "O cabeçalho Idempotency-Key deve ser um UUID."),
        null);
  }
}
