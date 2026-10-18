package dev.jotave.foody.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank(message = "Link de redefinição inválido.")
        @Size(max = 100, message = "Link de redefinição inválido.")
        String token,
    // BCrypt only uses the first 72 bytes of the input.
    @NotBlank(message = "Informe a senha.")
        @Size(min = 8, max = 72, message = "A senha deve ter entre 8 e 72 caracteres.")
        String password) {}
