package dev.jotave.foody.address;

import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Addresses are immutable: editing creates a new row and soft-deletes the old one, and deleting is
 * always a soft delete, so orders keep the exact address they were delivered to.
 *
 * <p>A user may have no address at all (it is optional at sign-up), but a user with any active
 * address has exactly one active default (at most one is also enforced by the partial unique index
 * {@code ux_addresses_default}). Hibernate flushes INSERTs before UPDATEs, so any write that frees
 * the default slot is flushed explicitly before the write that takes it.
 */
@Service
public class AddressService {

  private final AddressRepository addresses;
  private final UserRepository users;

  public AddressService(AddressRepository addresses, UserRepository users) {
    this.addresses = addresses;
    this.users = users;
  }

  /** Creates the user's first address, already flagged as default. Joins the caller's tx. */
  @Transactional(propagation = Propagation.MANDATORY)
  public Address createInitialDefault(User user, AddressRequest request) {
    return addresses.save(newAddress(user, request, true));
  }

  @Transactional(readOnly = true)
  public Optional<Address> findDefault(Long userId) {
    return addresses.findByUserIdAndIsDefaultTrueAndDeletedAtIsNull(userId);
  }

  @Transactional(readOnly = true)
  public List<Address> list(long userId) {
    return addresses.findAllActive(userId);
  }

  @Transactional(readOnly = true)
  public Address get(long userId, long addressId) {
    return findActive(userId, addressId);
  }

  /** Active address owned by the user, if any (e.g. to validate an order's delivery address). */
  @Transactional(readOnly = true)
  public Optional<Address> findOwnedActive(long userId, long addressId) {
    return addresses.findActive(addressId, userId);
  }

  @Transactional
  public Address create(long userId, AddressRequest request, boolean makeDefault) {
    Optional<Address> currentDefault = findDefault(userId);
    // A user's first address (e.g. added with their first order) always becomes the default.
    boolean isDefault = makeDefault || currentDefault.isEmpty();
    if (isDefault) {
      currentDefault.ifPresent(this::unmarkDefault);
    }
    return addresses.saveAndFlush(newAddress(users.getReferenceById(userId), request, isDefault));
  }

  /**
   * Creates a new version of the address and soft-deletes the old one, keeping its default flag.
   */
  @Transactional
  public Address update(long userId, long addressId, AddressRequest request) {
    Address current = findActive(userId, addressId);
    current.softDelete();
    // The partial index ignores deleted rows, so this frees the default slot for the new version.
    addresses.saveAndFlush(current);
    return addresses.saveAndFlush(newAddress(current.getUser(), request, current.isDefault()));
  }

  @Transactional
  public Address makeDefault(long userId, long addressId) {
    Address target = findActive(userId, addressId);
    if (target.isDefault()) {
      return target;
    }
    findDefault(userId).ifPresent(this::unmarkDefault);
    target.markDefault();
    return addresses.saveAndFlush(target);
  }

  @Transactional
  public void delete(long userId, long addressId) {
    Address target = findActive(userId, addressId);
    if (addresses.countByUserIdAndDeletedAtIsNull(userId) <= 1) {
      throw AddressConflictException.onlyAddress();
    }
    if (target.isDefault()) {
      throw AddressConflictException.defaultAddress();
    }
    target.softDelete();
    addresses.saveAndFlush(target);
  }

  private Address findActive(long userId, long addressId) {
    return addresses.findActive(addressId, userId).orElseThrow(AddressNotFoundException::new);
  }

  private void unmarkDefault(Address address) {
    address.unmarkDefault();
    addresses.saveAndFlush(address);
  }

  private static Address newAddress(User user, AddressRequest request, boolean isDefault) {
    return new Address(
        user,
        blankToNull(request.label()),
        request.street().trim(),
        request.number().trim(),
        blankToNull(request.complement()),
        request.neighborhood().trim(),
        request.city().trim(),
        request.state().toUpperCase(Locale.ROOT),
        request.zipCode().replace("-", ""),
        isDefault);
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
