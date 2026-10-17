package dev.jotave.foody.order;

import dev.jotave.foody.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One status change of an order. Only {@link Order} creates entries. */
@Entity
@Table(name = "order_status_history")
public class OrderStatusHistory {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JdbcTypeCode(SqlTypes.INTEGER)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "order_id", nullable = false)
  private Order order;

  /** Null only on the creation entry. */
  @Enumerated(EnumType.STRING)
  @Column(name = "from_status", length = 20)
  private OrderStatus fromStatus;

  @Enumerated(EnumType.STRING)
  @Column(name = "to_status", nullable = false, length = 20)
  private OrderStatus toStatus;

  @Column(name = "changed_at", nullable = false, updatable = false)
  private Instant changedAt;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "changed_by", nullable = false)
  private User changedBy;

  protected OrderStatusHistory() {}

  OrderStatusHistory(
      Order order,
      OrderStatus fromStatus,
      OrderStatus toStatus,
      Instant changedAt,
      User changedBy) {
    this.order = order;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.changedAt = changedAt;
    this.changedBy = changedBy;
  }

  public Long getId() {
    return id;
  }

  public Order getOrder() {
    return order;
  }

  public OrderStatus getFromStatus() {
    return fromStatus;
  }

  public OrderStatus getToStatus() {
    return toStatus;
  }

  public Instant getChangedAt() {
    return changedAt;
  }

  public User getChangedBy() {
    return changedBy;
  }
}
