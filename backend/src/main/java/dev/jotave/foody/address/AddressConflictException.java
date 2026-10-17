package dev.jotave.foody.address;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

public class AddressConflictException extends ErrorResponseException {

  static final String ONLY_ADDRESS = "Não é possível excluir seu único endereço.";
  static final String DEFAULT_ADDRESS =
      "Não é possível excluir o endereço padrão. Defina outro endereço como padrão antes.";

  private AddressConflictException(String detail) {
    super(HttpStatus.CONFLICT, ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, detail), null);
  }

  static AddressConflictException onlyAddress() {
    return new AddressConflictException(ONLY_ADDRESS);
  }

  static AddressConflictException defaultAddress() {
    return new AddressConflictException(DEFAULT_ADDRESS);
  }
}
