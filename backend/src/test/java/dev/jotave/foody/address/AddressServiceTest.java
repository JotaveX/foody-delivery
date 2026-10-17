package dev.jotave.foody.address;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.util.Optional;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

class AddressServiceTest {

  private static final long USER_ID = 1L;
  private static final long ADDRESS_ID = 10L;

  private final AddressRepository addresses = mock(AddressRepository.class);
  private final UserRepository users = mock(UserRepository.class);
  private final AddressService service = new AddressService(addresses, users);
  private final User user = new User("Maria", "maria@example.com", "hash");

  AddressServiceTest() {
    when(addresses.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
    when(users.getReferenceById(USER_ID)).thenReturn(user);
  }

  @Test
  void deletingTheOnlyAddressIsAConflict() {
    Address only = address(true);
    givenActive(only);
    when(addresses.countByUserIdAndDeletedAtIsNull(USER_ID)).thenReturn(1L);

    assertThatThrownBy(() -> service.delete(USER_ID, ADDRESS_ID))
        .isInstanceOf(AddressConflictException.class)
        .satisfies(detail(AddressConflictException.ONLY_ADDRESS));
    assertThat(only.isDeleted()).isFalse();
    verify(addresses, never()).saveAndFlush(any());
  }

  @Test
  void deletingTheDefaultAddressIsAConflict() {
    Address defaultAddress = address(true);
    givenActive(defaultAddress);
    when(addresses.countByUserIdAndDeletedAtIsNull(USER_ID)).thenReturn(2L);

    assertThatThrownBy(() -> service.delete(USER_ID, ADDRESS_ID))
        .isInstanceOf(AddressConflictException.class)
        .satisfies(detail(AddressConflictException.DEFAULT_ADDRESS));
    assertThat(defaultAddress.isDeleted()).isFalse();
  }

  @Test
  void deletingANonDefaultAddressIsASoftDelete() {
    Address other = address(false);
    givenActive(other);
    when(addresses.countByUserIdAndDeletedAtIsNull(USER_ID)).thenReturn(2L);

    service.delete(USER_ID, ADDRESS_ID);

    assertThat(other.getDeletedAt()).isNotNull();
    verify(addresses).saveAndFlush(other);
    verify(addresses, never()).delete(any());
  }

  @Test
  void addressOfAnotherUserIsNotFound() {
    when(addresses.findActive(ADDRESS_ID, USER_ID)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.get(USER_ID, ADDRESS_ID))
        .isInstanceOf(AddressNotFoundException.class);
    assertThatThrownBy(() -> service.update(USER_ID, ADDRESS_ID, request()))
        .isInstanceOf(AddressNotFoundException.class);
    assertThatThrownBy(() -> service.makeDefault(USER_ID, ADDRESS_ID))
        .isInstanceOf(AddressNotFoundException.class);
    assertThatThrownBy(() -> service.delete(USER_ID, ADDRESS_ID))
        .isInstanceOf(AddressNotFoundException.class);
  }

  @Test
  void makeDefaultUnmarksAndFlushesTheCurrentDefaultBeforeMarkingTheNewOne() {
    Address current = address(true);
    Address target = address(false);
    givenActive(target);
    givenDefault(current);

    Address result = service.makeDefault(USER_ID, ADDRESS_ID);

    assertThat(result).isSameAs(target);
    assertThat(target.isDefault()).isTrue();
    assertThat(current.isDefault()).isFalse();
    InOrder order = inOrder(addresses);
    order.verify(addresses).saveAndFlush(current);
    order.verify(addresses).saveAndFlush(target);
  }

  @Test
  void makeDefaultOnTheCurrentDefaultIsANoOp() {
    Address current = address(true);
    givenActive(current);

    assertThat(service.makeDefault(USER_ID, ADDRESS_ID)).isSameAs(current);
    verify(addresses, never()).saveAndFlush(any());
  }

  @Test
  void updateCreatesANewVersionAndSoftDeletesTheOldOneFirst() {
    Address old = address(true);
    givenActive(old);

    Address updated = service.update(USER_ID, ADDRESS_ID, request());

    assertThat(updated).isNotSameAs(old);
    assertThat(updated.isDefault()).isTrue();
    assertThat(updated.getStreet()).isEqualTo("Rua Nova");
    assertThat(updated.getUser()).isSameAs(user);
    assertThat(old.isDeleted()).isTrue();
    assertThat(old.getStreet()).isEqualTo("Rua Antiga");
    InOrder order = inOrder(addresses);
    order.verify(addresses).saveAndFlush(old);
    order.verify(addresses).saveAndFlush(updated);
  }

  @Test
  void updatingANonDefaultAddressKeepsItNonDefault() {
    givenActive(address(false));

    assertThat(service.update(USER_ID, ADDRESS_ID, request()).isDefault()).isFalse();
  }

  @Test
  void createWithMakeDefaultUnmarksTheCurrentDefaultFirst() {
    Address current = address(true);
    givenDefault(current);

    Address created = service.create(USER_ID, request(), true);

    assertThat(created.isDefault()).isTrue();
    assertThat(current.isDefault()).isFalse();
    InOrder order = inOrder(addresses);
    order.verify(addresses).saveAndFlush(current);
    order.verify(addresses).saveAndFlush(created);
  }

  @Test
  void createWithoutMakeDefaultKeepsTheCurrentDefault() {
    Address current = address(true);
    givenDefault(current);

    Address created = service.create(USER_ID, request(), false);

    assertThat(created.isDefault()).isFalse();
    assertThat(current.isDefault()).isTrue();
    verify(addresses, never()).saveAndFlush(current);
  }

  @Test
  void createNormalizesTheInput() {
    givenDefault(address(true));
    var request =
        new AddressRequest(" ", " Rua Nova ", "10", "", "Centro", "Campinas", "sp", "13010-000");

    ArgumentCaptor<Address> saved = ArgumentCaptor.forClass(Address.class);
    service.create(USER_ID, request, false);
    verify(addresses).saveAndFlush(saved.capture());

    assertThat(saved.getValue())
        .extracting(
            Address::getLabel,
            Address::getStreet,
            Address::getComplement,
            Address::getState,
            Address::getZipCode)
        .containsExactly(null, "Rua Nova", null, "SP", "13010000");
  }

  private void givenActive(Address address) {
    when(addresses.findActive(ADDRESS_ID, USER_ID)).thenReturn(Optional.of(address));
  }

  private void givenDefault(Address address) {
    when(addresses.findByUserIdAndIsDefaultTrueAndDeletedAtIsNull(USER_ID))
        .thenReturn(Optional.of(address));
  }

  private Address address(boolean isDefault) {
    return new Address(
        user, "Casa", "Rua Antiga", "1", null, "Centro", "Campinas", "SP", "13010000", isDefault);
  }

  private static AddressRequest request() {
    return new AddressRequest(
        "Trabalho", "Rua Nova", "200", "Sala 3", "Centro", "Campinas", "SP", "13010000");
  }

  private static Consumer<Throwable> detail(String expected) {
    return e ->
        assertThat(((AddressConflictException) e).getBody().getDetail()).isEqualTo(expected);
  }
}
