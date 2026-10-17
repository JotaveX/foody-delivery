package dev.jotave.foody.user;

import dev.jotave.foody.address.AddressResponse;
import java.time.Instant;

/** Public view of a user: never carries the password hash or token version. */
public record UserResponse(
    Long id, String name, String email, Instant createdAt, AddressResponse defaultAddress) {

  public static UserResponse from(User user, AddressResponse defaultAddress) {
    return new UserResponse(
        user.getId(), user.getName(), user.getEmail(), user.getCreatedAt(), defaultAddress);
  }
}
