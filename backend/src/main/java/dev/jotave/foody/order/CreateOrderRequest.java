package dev.jotave.foody.order;

import dev.jotave.foody.address.AddressRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * The delivery address comes in exactly one of two forms: {@code addressId} (an active address of
 * the current user) or {@code newAddress}, which is added to the user's profile in the same
 * transaction ({@code saveAsDefault} makes it the default and is only valid with it).
 */
@ExactlyOneDeliveryAddress
public record CreateOrderRequest(
    @NotBlank(message = "Informe o nome do cliente.")
        @Size(max = 100, message = "O nome do cliente deve ter no máximo 100 caracteres.")
        String customerName,
    @NotEmpty(message = "Informe ao menos um item.")
        @Size(max = 50, message = "O pedido pode ter no máximo 50 itens.")
        List<@Valid OrderItemRequest> items,
    Long addressId,
    @Valid AddressRequest newAddress,
    Boolean saveAsDefault) {

  public boolean shouldSaveAsDefault() {
    return Boolean.TRUE.equals(saveAsDefault);
  }
}
