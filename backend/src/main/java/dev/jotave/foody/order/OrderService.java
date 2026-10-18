package dev.jotave.foody.order;

import dev.jotave.foody.address.Address;
import dev.jotave.foody.address.AddressService;
import dev.jotave.foody.catalog.CatalogService;
import dev.jotave.foody.catalog.Product;
import dev.jotave.foody.order.OrderResponses.HistoryEntry;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import dev.jotave.foody.order.OrderResponses.OrderSummary;
import dev.jotave.foody.order.OrderResponses.PageResponse;
import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderService {

  static final int MAX_PAGE_SIZE = 100;
  private static final Sort NEWEST_FIRST =
      Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

  private final OrderRepository orders;
  private final AddressService addressService;
  private final UserRepository users;
  private final CatalogService catalog;
  private final OrderMapper mapper;
  private final ApplicationEventPublisher events;

  public OrderService(
      OrderRepository orders,
      AddressService addressService,
      UserRepository users,
      CatalogService catalog,
      OrderMapper mapper,
      ApplicationEventPublisher events) {
    this.orders = orders;
    this.addressService = addressService;
    this.users = users;
    this.catalog = catalog;
    this.mapper = mapper;
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
                resolveItems(request.items()),
                user));
    return publish(order, null, userId);
  }

  // Not cached, see OrderCacheConfig.
  @Transactional(readOnly = true)
  public PageResponse<OrderSummary> list(OrderStatus status, int page, int size) {
    var pageable =
        PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE), NEWEST_FIRST);
    Page<Order> result =
        status == null ? orders.findAll(pageable) : orders.findByStatus(status, pageable);
    return new PageResponse<>(
        result.getContent().stream().map(mapper::toSummary).toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  // Evicted by OrderCacheEvictor after every committed change.
  @Cacheable(cacheNames = OrderCacheConfig.ORDER_DETAILS, key = "#orderId")
  @Transactional(readOnly = true)
  public OrderDetail get(long orderId) {
    return mapper.toDetail(find(orderId));
  }

  @Transactional
  public OrderDetail changeStatus(long orderId, OrderStatus next, long userId) {
    Order order = find(orderId);
    OrderStatus previous = order.getStatus();
    order.changeStatus(next, users.getReferenceById(userId));
    // Flush now so an optimistic-lock conflict surfaces here (409), before the event goes out.
    orders.saveAndFlush(order);
    return publish(order, previous, userId);
  }

  @Transactional(readOnly = true)
  public List<HistoryEntry> history(long orderId) {
    if (!orders.existsById(orderId)) {
      throw new OrderNotFoundException();
    }
    return orders.findHistory(orderId).stream().map(mapper::toHistoryEntry).toList();
  }

  /**
   * One item per product (repeated productIds are summed), priced from the catalog as it is now.
   * Prices sent by the client never get here: {@link OrderItemRequest} has no price.
   */
  private List<OrderItem> resolveItems(List<OrderItemRequest> requested) {
    Map<Long, Integer> quantities = new LinkedHashMap<>();
    requested.forEach(item -> quantities.merge(item.productId(), item.quantity(), Integer::sum));

    Map<Long, Product> available =
        catalog.findActive(quantities.keySet()).stream()
            .collect(Collectors.toMap(Product::getId, Function.identity()));
    List<Long> unavailable =
        quantities.keySet().stream().filter(id -> !available.containsKey(id)).toList();
    if (!unavailable.isEmpty()) {
      throw new UnavailableProductException(unavailable);
    }
    if (quantities.values().stream().anyMatch(q -> q > OrderItem.MAX_QUANTITY)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "A quantidade de cada produto deve ser no máximo 999.");
    }

    return quantities.entrySet().stream()
        .map(e -> new OrderItem(available.get(e.getKey()), e.getValue()))
        .toList();
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

  private OrderDetail publish(Order order, OrderStatus previous, long userId) {
    OrderDetail detail = mapper.toDetail(order);
    events.publishEvent(
        new OrderChangedEvent(
            order.getId(), previous, order.getStatus(), userId, order.getUpdatedAt(), detail));
    return detail;
  }
}
