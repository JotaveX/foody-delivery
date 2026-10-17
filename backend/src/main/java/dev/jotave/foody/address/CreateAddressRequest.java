package dev.jotave.foody.address;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * @param makeDefault when true the new address replaces the current default
 */
public record CreateAddressRequest(
    @NotNull(message = "Informe o endereço.") @Valid AddressRequest address, Boolean makeDefault) {

  public boolean shouldMakeDefault() {
    return Boolean.TRUE.equals(makeDefault);
  }
}
