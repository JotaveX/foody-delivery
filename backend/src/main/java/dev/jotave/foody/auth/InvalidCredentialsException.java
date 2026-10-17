package dev.jotave.foody.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Deliberately generic: never reveals whether the e-mail exists. */
public class InvalidCredentialsException extends ErrorResponseException {

  public InvalidCredentialsException() {
    super(
        HttpStatus.UNAUTHORIZED,
        ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos."),
        null);
  }
}
