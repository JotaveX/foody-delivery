package dev.jotave.foody.address;

public record AddressResponse(
    Long id,
    String label,
    String street,
    String number,
    String complement,
    String neighborhood,
    String city,
    String state,
    String zipCode,
    boolean isDefault) {

  public static AddressResponse from(Address address) {
    return new AddressResponse(
        address.getId(),
        address.getLabel(),
        address.getStreet(),
        address.getNumber(),
        address.getComplement(),
        address.getNeighborhood(),
        address.getCity(),
        address.getState(),
        address.getZipCode(),
        address.isDefault());
  }
}
