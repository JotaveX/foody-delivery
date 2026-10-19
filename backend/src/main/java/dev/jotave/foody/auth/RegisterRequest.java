package dev.jotave.foody.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Sign-up takes no address: the user adds one with their first order (or on /addresses). */
public record RegisterRequest(
    @NotBlank(message = "Informe o nome.")
        @Size(max = 100, message = "O nome deve ter no máximo 100 caracteres.")
        String name,
    @NotBlank(message = "Informe o e-mail.")
        @Email(message = "Informe um e-mail válido.")
        @Size(max = 254, message = "O e-mail deve ter no máximo 254 caracteres.")
        String email,
    @NotBlank(message = "Informe a senha.")
        @Size(min = 8, message = "A senha deve ter no mínimo 8 caracteres.")
        @FitsBcrypt
        String password) {}
