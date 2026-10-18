package dev.jotave.foody.order;

import dev.jotave.foody.catalog.Product;
import dev.jotave.foody.common.MoneyCentsConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "order_items")
public class OrderItem {

  public static final int MAX_QUANTITY = 999;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JdbcTypeCode(SqlTypes.INTEGER)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "order_id", nullable = false)
  private Order order;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "product_id", nullable = false, updatable = false)
  private Product product;

  @Column(nullable = false)
  private int quantity;

  /** Snapshot of the product price when the order was created; never follows later changes. */
  @Convert(converter = MoneyCentsConverter.class)
  @Column(name = "unit_price_cents", nullable = false, updatable = false)
  private BigDecimal unitPrice;

  protected OrderItem() {}

  /**
   * Takes the unit price from the product as it is now.
   *
   * @throws IllegalArgumentException if the quantity is not between 1 and {@link #MAX_QUANTITY}
   */
  public OrderItem(Product product, int quantity) {
    Objects.requireNonNull(product, "product");
    if (quantity <= 0 || quantity > MAX_QUANTITY) {
      throw new IllegalArgumentException("Item quantity out of range: " + quantity);
    }
    this.product = product;
    this.quantity = quantity;
    this.unitPrice = product.getPrice();
  }

  void attachTo(Order order) {
    this.order = order;
  }

  public BigDecimal subtotal() {
    return unitPrice.multiply(BigDecimal.valueOf(quantity));
  }

  public Long getId() {
    return id;
  }

  public Order getOrder() {
    return order;
  }

  public Product getProduct() {
    return product;
  }

  public int getQuantity() {
    return quantity;
  }

  public BigDecimal getUnitPrice() {
    return unitPrice;
  }
}
