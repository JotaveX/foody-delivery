package dev.jotave.foody.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank(message = "Link de redefinição inválido.")
        @Size(max = 100, message = "Link de redefinição inválido.")
        String token,
    @NotBlank(message = "Informe a senha.")
        @Size(min = 8, message = "A senha deve ter no mínimo 8 caracteres.")
        @FitsBcrypt
        String password) {}
