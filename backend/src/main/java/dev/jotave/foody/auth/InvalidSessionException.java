package dev.jotave.foody.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** 401 for a token that authenticated but whose user is gone (e.g. deleted mid-request). */
public class InvalidSessionException extends ErrorResponseException {

  static final String DETAIL = "Token inválido ou expirado. Faça login novamente.";

  public InvalidSessionException() {
    super(
        HttpStatus.UNAUTHORIZED,
        ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, DETAIL),
        null);
  }
}
