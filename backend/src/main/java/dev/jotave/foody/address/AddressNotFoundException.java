package dev.jotave.foody.address;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Also thrown for another user's address, so its existence is not revealed. */
public class AddressNotFoundException extends ErrorResponseException {

  public AddressNotFoundException() {
    super(
        HttpStatus.NOT_FOUND,
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Endereço não encontrado."),
        null);
  }
}
