package dev.jotave.foody.address;

import dev.jotave.foody.user.User;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AddressService {

  private final AddressRepository addresses;

  public AddressService(AddressRepository addresses) {
    this.addresses = addresses;
  }

  /** Creates the user's first address, already flagged as default. Joins the caller's tx. */
  @Transactional(propagation = Propagation.MANDATORY)
  public Address createInitialDefault(User user, AddressRequest request) {
    return addresses.save(
        new Address(
            user,
            blankToNull(request.label()),
            request.street().trim(),
            request.number().trim(),
            blankToNull(request.complement()),
            request.neighborhood().trim(),
            request.city().trim(),
            request.state().toUpperCase(Locale.ROOT),
            request.zipCode().replace("-", ""),
            true));
  }

  @Transactional(readOnly = true)
  public Optional<Address> findDefault(Long userId) {
    return addresses.findByUserIdAndIsDefaultTrueAndDeletedAtIsNull(userId);
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
