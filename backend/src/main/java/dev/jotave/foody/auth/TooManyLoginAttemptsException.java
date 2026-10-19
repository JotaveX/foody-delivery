package dev.jotave.foody.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** 429: too many failed logins for this e-mail, from whatever IPs. */
public class TooManyLoginAttemptsException extends ErrorResponseException {

  public TooManyLoginAttemptsException(long retryAfterSeconds) {
    super(
        HttpStatus.TOO_MANY_REQUESTS,
        ProblemDetail.forStatusAndDetail(
            HttpStatus.TOO_MANY_REQUESTS,
            "Muitas tentativas de login para este e-mail. Tente novamente em %d minuto%s."
                .formatted(minutes(retryAfterSeconds), minutes(retryAfterSeconds) == 1 ? "" : "s")),
        null);
    getHeaders().set(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSeconds));
  }

  private static long minutes(long seconds) {
    return Math.max(1, (seconds + 59) / 60);
  }
}
