package dev.jotave.foody.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Response DTOs of the order API. */
public final class OrderResponses {

  private OrderResponses() {}

  public record OrderSummary(
      Long id,
      String customerName,
      OrderStatus status,
      BigDecimal totalAmount,
      int itemCount,
      DeliveryAddress deliveryAddress,
      Instant createdAt,
      Instant updatedAt) {}

  public record OrderDetail(
      Long id,
      String customerName,
      OrderStatus status,
      BigDecimal totalAmount,
      List<Item> items,
      DeliveryAddress deliveryAddress,
      UserRef createdBy,
      Instant createdAt,
      Instant updatedAt) {}

  public record Item(
      Long id,
      String name,
      int quantity,
      BigDecimal unitPrice,
      BigDecimal subtotal,
      String imageUrl) {}

  /** The exact address the order was sent to, even if since edited or deleted in the profile. */
  public record DeliveryAddress(
      Long id,
      String label,
      String street,
      String number,
      String complement,
      String neighborhood,
      String city,
      String state,
      String zipCode) {}

  public record UserRef(Long id, String name) {}

  public record HistoryEntry(
      OrderStatus fromStatus, OrderStatus toStatus, Instant changedAt, UserRef changedBy) {}

  public record PageResponse<T>(
      List<T> content, int page, int size, long totalElements, int totalPages) {}
}
