package dev.jotave.foody.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Missing, unknown, expired, reused or revoked refresh token: the session is over. */
public class InvalidRefreshTokenException extends ErrorResponseException {

  public InvalidRefreshTokenException() {
    super(
        HttpStatus.UNAUTHORIZED,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.UNAUTHORIZED, "Sessão expirada. Faça login novamente."),
        null);
  }
}
