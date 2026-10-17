package dev.jotave.foody.order;

import dev.jotave.foody.address.Address;
import dev.jotave.foody.order.OrderResponses.DeliveryAddress;
import dev.jotave.foody.order.OrderResponses.HistoryEntry;
import dev.jotave.foody.order.OrderResponses.Item;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import dev.jotave.foody.order.OrderResponses.OrderSummary;
import dev.jotave.foody.order.OrderResponses.UserRef;
import dev.jotave.foody.user.User;

/** Entity → DTO mapping. Must run inside a transaction: it touches lazy associations. */
final class OrderMapper {

  private OrderMapper() {}

  static OrderSummary toSummary(Order order) {
    return new OrderSummary(
        order.getId(),
        order.getCustomerName(),
        order.getStatus(),
        order.getTotalAmount(),
        order.getItems().size(),
        order.getCreatedAt(),
        order.getUpdatedAt());
  }

  static OrderDetail toDetail(Order order) {
    return new OrderDetail(
        order.getId(),
        order.getCustomerName(),
        order.getStatus(),
        order.getTotalAmount(),
        order.getItems().stream().map(OrderMapper::toItem).toList(),
        toDeliveryAddress(order.getDeliveryAddress()),
        toUserRef(order.getCreatedBy()),
        order.getCreatedAt(),
        order.getUpdatedAt());
  }

  static HistoryEntry toHistoryEntry(OrderStatusHistory entry) {
    return new HistoryEntry(
        entry.getFromStatus(),
        entry.getToStatus(),
        entry.getChangedAt(),
        toUserRef(entry.getChangedBy()));
  }

  private static Item toItem(OrderItem item) {
    return new Item(
        item.getId(),
        item.getName(),
        item.getQuantity(),
        item.getUnitPrice(),
        item.subtotal(),
        item.getImageUrl());
  }

  private static DeliveryAddress toDeliveryAddress(Address address) {
    return new DeliveryAddress(
        address.getId(),
        address.getLabel(),
        address.getStreet(),
        address.getNumber(),
        address.getComplement(),
        address.getNeighborhood(),
        address.getCity(),
        address.getState(),
        address.getZipCode());
  }

  private static UserRef toUserRef(User user) {
    return new UserRef(user.getId(), user.getName());
  }
}
