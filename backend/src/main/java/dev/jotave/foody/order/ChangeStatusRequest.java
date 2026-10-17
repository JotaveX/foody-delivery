package dev.jotave.foody.order;

import jakarta.validation.constraints.NotNull;

public record ChangeStatusRequest(@NotNull(message = "Informe o status.") OrderStatus status) {}
