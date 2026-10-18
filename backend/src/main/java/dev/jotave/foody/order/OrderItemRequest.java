package dev.jotave.foody.order;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * A catalog product and how many of it. There is deliberately no price: the unit price is always
 * copied from the product on the server (unknown JSON fields such as {@code unitPrice} are
 * ignored).
 */
public record OrderItemRequest(
    @NotNull(message = "Informe o produto.") @Positive(message = "Produto inválido.")
        Long productId,
    @NotNull(message = "Informe a quantidade.")
        @Positive(message = "A quantidade deve ser maior que zero.")
        @Max(value = OrderItem.MAX_QUANTITY, message = "A quantidade deve ser no máximo 999.")
        Integer quantity) {}
