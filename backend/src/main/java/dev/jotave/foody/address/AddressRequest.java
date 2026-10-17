package dev.jotave.foody.address;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AddressRequest(
    @Size(max = 30, message = "O rótulo deve ter no máximo 30 caracteres.") String label,
    @NotBlank(message = "Informe a rua.")
        @Size(max = 150, message = "A rua deve ter no máximo 150 caracteres.")
        String street,
    @NotBlank(message = "Informe o número.")
        @Size(max = 20, message = "O número deve ter no máximo 20 caracteres.")
        String number,
    @Size(max = 100, message = "O complemento deve ter no máximo 100 caracteres.")
        String complement,
    @NotBlank(message = "Informe o bairro.")
        @Size(max = 100, message = "O bairro deve ter no máximo 100 caracteres.")
        String neighborhood,
    @NotBlank(message = "Informe a cidade.")
        @Size(max = 100, message = "A cidade deve ter no máximo 100 caracteres.")
        String city,
    @NotBlank(message = "Informe a UF.")
        @Pattern(regexp = "[A-Za-z]{2}", message = "A UF deve ter 2 letras.")
        String state,
    @NotBlank(message = "Informe o CEP.")
        @Pattern(regexp = "\\d{5}-?\\d{3}", message = "O CEP deve ter 8 dígitos.")
        String zipCode) {}
