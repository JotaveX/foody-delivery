package dev.jotave.foody.address;

import dev.jotave.foody.auth.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/addresses")
@SecurityRequirement(name = "bearer")
public class AddressController {

  private final AddressService addressService;

  public AddressController(AddressService addressService) {
    this.addressService = addressService;
  }

  @Operation(summary = "Active addresses of the current user, default first")
  @GetMapping
  public List<AddressResponse> list(@AuthenticationPrincipal AuthenticatedUser principal) {
    return addressService.list(principal.id()).stream().map(AddressResponse::from).toList();
  }

  @Operation(summary = "One active address of the current user")
  @GetMapping("/{id}")
  public AddressResponse get(
      @AuthenticationPrincipal AuthenticatedUser principal, @PathVariable long id) {
    return AddressResponse.from(addressService.get(principal.id(), id));
  }

  @Operation(summary = "Add an address, optionally making it the default")
  @PostMapping
  public ResponseEntity<AddressResponse> create(
      @AuthenticationPrincipal AuthenticatedUser principal,
      @Valid @RequestBody CreateAddressRequest request) {
    Address address =
        addressService.create(principal.id(), request.address(), request.shouldMakeDefault());
    return ResponseEntity.created(URI.create("/addresses/" + address.getId()))
        .body(AddressResponse.from(address));
  }

  @Operation(
      summary = "Edit an address",
      description =
          "Addresses are immutable: a new version is created (new id) and the old one is soft"
              + " deleted, keeping its default flag.")
  @PutMapping("/{id}")
  public AddressResponse update(
      @AuthenticationPrincipal AuthenticatedUser principal,
      @PathVariable long id,
      @Valid @RequestBody AddressRequest request) {
    return AddressResponse.from(addressService.update(principal.id(), id, request));
  }

  @Operation(summary = "Make an address the default one")
  @PatchMapping("/{id}/default")
  public AddressResponse makeDefault(
      @AuthenticationPrincipal AuthenticatedUser principal, @PathVariable long id) {
    return AddressResponse.from(addressService.makeDefault(principal.id(), id));
  }

  @Operation(summary = "Soft delete an address (never the default nor the last one)")
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(
      @AuthenticationPrincipal AuthenticatedUser principal, @PathVariable long id) {
    addressService.delete(principal.id(), id);
    return ResponseEntity.noContent().build();
  }
}
