package dev.jotave.foody.order;

import dev.jotave.foody.address.Address;
import dev.jotave.foody.catalog.CatalogProperties;
import dev.jotave.foody.catalog.Product;
import dev.jotave.foody.order.OrderResponses.DeliveryAddress;
import dev.jotave.foody.order.OrderResponses.HistoryEntry;
import dev.jotave.foody.order.OrderResponses.Item;
import dev.jotave.foody.order.OrderResponses.ItemPreview;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import dev.jotave.foody.order.OrderResponses.OrderSummary;
import dev.jotave.foody.order.OrderResponses.UserRef;
import dev.jotave.foody.user.User;
import org.springframework.stereotype.Component;

/** Entity → DTO mapping. Must run inside a transaction: it touches lazy associations. */
@Component
class OrderMapper {

  private final CatalogProperties catalog;

  OrderMapper(CatalogProperties catalog) {
    this.catalog = catalog;
  }

  OrderSummary toSummary(Order order) {
    return new OrderSummary(
        order.getId(),
        order.getCustomerName(),
        order.getStatus(),
        order.getTotalAmount(),
        order.getItems().size(),
        order.getItems().stream().map(this::toItemPreview).toList(),
        toDeliveryAddress(order.getDeliveryAddress()),
        order.getCreatedAt(),
        order.getUpdatedAt());
  }

  OrderDetail toDetail(Order order) {
    return new OrderDetail(
        order.getId(),
        order.getCustomerName(),
        order.getStatus(),
        order.getTotalAmount(),
        order.getItems().stream().map(this::toItem).toList(),
        toDeliveryAddress(order.getDeliveryAddress()),
        toUserRef(order.getCreatedBy()),
        order.getCreatedAt(),
        order.getUpdatedAt());
  }

  HistoryEntry toHistoryEntry(OrderStatusHistory entry) {
    return new HistoryEntry(
        entry.getFromStatus(),
        entry.getToStatus(),
        entry.getChangedAt(),
        toUserRef(entry.getChangedBy()));
  }

  private Item toItem(OrderItem item) {
    Product product = item.getProduct();
    return new Item(
        product.getId(),
        product.getName(),
        catalog.imageUrl(product.getImageKey()),
        item.getQuantity(),
        item.getUnitPrice(),
        item.subtotal());
  }

  private ItemPreview toItemPreview(OrderItem item) {
    Product product = item.getProduct();
    return new ItemPreview(
        product.getId(),
        product.getName(),
        catalog.imageUrl(product.getImageKey()),
        item.getQuantity(),
        item.subtotal());
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
