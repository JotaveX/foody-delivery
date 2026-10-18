package dev.jotave.foody.order;

import dev.jotave.foody.address.Address;
import dev.jotave.foody.common.MoneyCentsConverter;
import dev.jotave.foody.common.Timestamps;
import dev.jotave.foody.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Order aggregate: owns its items and status history. The status only changes through {@link
 * #changeStatus}, which enforces the {@link OrderStatus} state machine and records history.
 */
@Entity
@Table(name = "orders")
public class Order {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JdbcTypeCode(SqlTypes.INTEGER)
  private Long id;

  @Column(name = "customer_name", nullable = false, length = 100)
  private String customerName;

  /** The exact (immutable) address used for delivery, even if later edited or deleted. */
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "address_id", nullable = false)
  private Address deliveryAddress;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private OrderStatus status;

  /** Derived from the items at creation; persisted so listings need no join. */
  @Convert(converter = MoneyCentsConverter.class)
  @Column(name = "total_amount_cents", nullable = false)
  private BigDecimal totalAmount;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "created_by", nullable = false, updatable = false)
  private User createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Version
  @Column(nullable = false)
  private Integer version;

  // Batch-loaded so listing a page of orders (item count) does not issue one query per order.
  @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("id")
  @BatchSize(size = 100)
  private List<OrderItem> items = new ArrayList<>();

  @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
  @OrderBy("changedAt, id")
  private List<OrderStatusHistory> statusHistory = new ArrayList<>();

  protected Order() {}

  /**
   * Creates a new order in {@link OrderStatus#RECEBIDO}, recording the initial {@code null ->
   * RECEBIDO} history entry.
   *
   * @throws IllegalArgumentException if the customer name is blank, there are no items or the
   *     address is deleted
   */
  public static Order create(
      String customerName, Address deliveryAddress, List<OrderItem> items, User createdBy) {
    if (customerName == null || customerName.isBlank()) {
      throw new IllegalArgumentException("Customer name must not be blank");
    }
    Objects.requireNonNull(deliveryAddress, "deliveryAddress");
    Objects.requireNonNull(createdBy, "createdBy");
    if (deliveryAddress.isDeleted()) {
      throw new IllegalArgumentException("Delivery address is deleted");
    }
    if (items == null || items.isEmpty()) {
      throw new IllegalArgumentException("An order needs at least one item");
    }

    Order order = new Order();
    order.customerName = customerName.trim();
    order.deliveryAddress = deliveryAddress;
    order.createdBy = createdBy;
    order.createdAt = Timestamps.now();
    order.updatedAt = order.createdAt;
    items.forEach(order::addItem);
    order.totalAmount =
        order.items.stream().map(OrderItem::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    order.status = OrderStatus.RECEBIDO;
    order.recordHistory(null, OrderStatus.RECEBIDO, createdBy);
    return order;
  }

  /**
   * Moves the order to {@code next}, recording who did it.
   *
   * @throws InvalidStatusTransitionException if the state machine does not allow the transition;
   *     the order is left untouched
   */
  public void changeStatus(OrderStatus next, User changedBy) {
    Objects.requireNonNull(next, "next");
    Objects.requireNonNull(changedBy, "changedBy");
    if (!status.canTransitionTo(next)) {
      throw new InvalidStatusTransitionException(status, next);
    }
    OrderStatus previous = status;
    status = next;
    updatedAt = Timestamps.now();
    recordHistory(previous, next, changedBy);
  }

  private void addItem(OrderItem item) {
    item.attachTo(this);
    items.add(item);
  }

  private void recordHistory(OrderStatus from, OrderStatus to, User by) {
    statusHistory.add(new OrderStatusHistory(this, from, to, updatedAt, by));
  }

  public Long getId() {
    return id;
  }

  public String getCustomerName() {
    return customerName;
  }

  public Address getDeliveryAddress() {
    return deliveryAddress;
  }

  public OrderStatus getStatus() {
    return status;
  }

  public BigDecimal getTotalAmount() {
    return totalAmount;
  }

  public User getCreatedBy() {
    return createdBy;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public Integer getVersion() {
    return version;
  }

  public List<OrderItem> getItems() {
    return Collections.unmodifiableList(items);
  }

  public List<OrderStatusHistory> getStatusHistory() {
    return Collections.unmodifiableList(statusHistory);
  }
}
