package dev.jotave.foody.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Unknown, expired, already used or superseded (the password changed since it was issued). */
public class InvalidPasswordResetTokenException extends ErrorResponseException {

  public InvalidPasswordResetTokenException() {
    super(
        HttpStatus.BAD_REQUEST,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "Link de redefinição inválido ou expirado. Solicite um novo."),
        null);
  }
}
