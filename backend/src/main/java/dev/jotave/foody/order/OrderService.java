package dev.jotave.foody.order;

import dev.jotave.foody.address.Address;
import dev.jotave.foody.address.AddressService;
import dev.jotave.foody.order.OrderResponses.HistoryEntry;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import dev.jotave.foody.order.OrderResponses.OrderSummary;
import dev.jotave.foody.order.OrderResponses.PageResponse;
import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

  static final int MAX_PAGE_SIZE = 100;
  private static final Sort NEWEST_FIRST =
      Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

  private final OrderRepository orders;
  private final AddressService addressService;
  private final UserRepository users;
  private final ApplicationEventPublisher events;

  public OrderService(
      OrderRepository orders,
      AddressService addressService,
      UserRepository users,
      ApplicationEventPublisher events) {
    this.orders = orders;
    this.addressService = addressService;
    this.users = users;
    this.events = events;
  }

  @Transactional
  public OrderDetail create(long userId, CreateOrderRequest request) {
    User user = users.getReferenceById(userId);
    Order order =
        orders.save(
            Order.create(
                request.customerName(),
                resolveDeliveryAddress(userId, request),
                request.items().stream()
                    .map(i -> new OrderItem(i.name(), i.quantity(), i.unitPrice(), i.imageUrl()))
                    .toList(),
                user));
    publish(order, null, userId);
    return OrderMapper.toDetail(order);
  }

  @Transactional(readOnly = true)
  public PageResponse<OrderSummary> list(OrderStatus status, int page, int size) {
    var pageable =
        PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE), NEWEST_FIRST);
    Page<Order> result =
        status == null ? orders.findAll(pageable) : orders.findByStatus(status, pageable);
    return new PageResponse<>(
        result.getContent().stream().map(OrderMapper::toSummary).toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  @Transactional(readOnly = true)
  public OrderDetail get(long orderId) {
    return OrderMapper.toDetail(find(orderId));
  }

  @Transactional
  public OrderDetail changeStatus(long orderId, OrderStatus next, long userId) {
    Order order = find(orderId);
    OrderStatus previous = order.getStatus();
    order.changeStatus(next, users.getReferenceById(userId));
    // Flush now so an optimistic-lock conflict surfaces here (409), before the event goes out.
    orders.saveAndFlush(order);
    publish(order, previous, userId);
    return OrderMapper.toDetail(order);
  }

  @Transactional(readOnly = true)
  public List<HistoryEntry> history(long orderId) {
    if (!orders.existsById(orderId)) {
      throw new OrderNotFoundException();
    }
    return orders.findHistory(orderId).stream().map(OrderMapper::toHistoryEntry).toList();
  }

  private Address resolveDeliveryAddress(long userId, CreateOrderRequest request) {
    if (request.newAddress() != null) {
      // Joins this transaction: if the order fails, the new address is rolled back too.
      return addressService.create(userId, request.newAddress(), request.shouldSaveAsDefault());
    }
    return addressService
        .findOwnedActive(userId, request.addressId())
        .orElseThrow(UnusableDeliveryAddressException::new);
  }

  private Order find(long orderId) {
    return orders.findDetailed(orderId).orElseThrow(OrderNotFoundException::new);
  }

  private void publish(Order order, OrderStatus previous, long userId) {
    events.publishEvent(
        new OrderChangedEvent(
            order.getId(), previous, order.getStatus(), userId, order.getUpdatedAt()));
  }
}
