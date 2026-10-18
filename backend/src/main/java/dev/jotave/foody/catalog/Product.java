package dev.jotave.foody.catalog;

import dev.jotave.foody.common.MoneyCentsConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Catalog product. Reference data seeded by Flyway: the application never writes it ({@link
 * Immutable}), so there are no setters; orders copy the price at creation time.
 */
@Entity
@Immutable
// Order items load their products lazily: batch them so a page of orders is not one query each.
@BatchSize(size = 50)
@Table(name = "products")
public class Product {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JdbcTypeCode(SqlTypes.INTEGER)
  private Long id;

  @Column(nullable = false, unique = true, length = 60)
  private String slug;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(nullable = false, length = 200)
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private ProductCategory category;

  @Convert(converter = MoneyCentsConverter.class)
  @Column(name = "price_cents", nullable = false)
  private BigDecimal price;

  /** Object path in the public images bucket, e.g. {@code catalog/pizza-calabresa.webp}. */
  @Column(name = "image_key", nullable = false, length = 200)
  private String imageKey;

  @Column(nullable = false)
  private boolean active;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  protected Product() {}

  /** For tests: products are only ever created by migrations. */
  public Product(
      String slug,
      String name,
      String description,
      ProductCategory category,
      BigDecimal price,
      String imageKey) {
    this.slug = slug;
    this.name = name;
    this.description = description;
    this.category = category;
    this.price = price.setScale(2, RoundingMode.UNNECESSARY);
    this.imageKey = imageKey;
    this.active = true;
  }

  public Long getId() {
    return id;
  }

  public String getSlug() {
    return slug;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public ProductCategory getCategory() {
    return category;
  }

  public BigDecimal getPrice() {
    return price;
  }

  public String getImageKey() {
    return imageKey;
  }

  public boolean isActive() {
    return active;
  }

  public int getDisplayOrder() {
    return displayOrder;
  }
}
