package dev.jotave.foody.order;

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
import java.math.RoundingMode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "order_items")
public class OrderItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JdbcTypeCode(SqlTypes.INTEGER)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "order_id", nullable = false)
  private Order order;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(nullable = false)
  private int quantity;

  @Convert(converter = MoneyCentsConverter.class)
  @Column(name = "unit_price_cents", nullable = false)
  private BigDecimal unitPrice;

  @Column(name = "image_url", length = 500)
  private String imageUrl;

  protected OrderItem() {}

  /**
   * @throws IllegalArgumentException if the name is blank, the quantity is not positive or the unit
   *     price is not positive or has more than 2 decimal places
   */
  public OrderItem(String name, int quantity, BigDecimal unitPrice, String imageUrl) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("Item name must not be blank");
    }
    if (quantity <= 0) {
      throw new IllegalArgumentException("Item quantity must be positive: " + quantity);
    }
    if (unitPrice == null || unitPrice.signum() <= 0) {
      throw new IllegalArgumentException("Item unit price must be positive: " + unitPrice);
    }
    if (unitPrice.stripTrailingZeros().scale() > 2) {
      throw new IllegalArgumentException("Item unit price has fractions of a cent: " + unitPrice);
    }
    this.name = name.trim();
    this.quantity = quantity;
    this.unitPrice = unitPrice.setScale(2, RoundingMode.UNNECESSARY);
    this.imageUrl = imageUrl;
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

  public String getName() {
    return name;
  }

  public int getQuantity() {
    return quantity;
  }

  public BigDecimal getUnitPrice() {
    return unitPrice;
  }

  public String getImageUrl() {
    return imageUrl;
  }
}
