package dev.jotave.foody.address;

import dev.jotave.foody.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Entity
@Table(name = "addresses")
public class Address {

  // SQLite only aliases the rowid for a column declared exactly "INTEGER PRIMARY KEY".
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @JdbcTypeCode(SqlTypes.INTEGER)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(length = 30)
  private String label;

  @Column(nullable = false, length = 150)
  private String street;

  @Column(nullable = false, length = 20)
  private String number;

  @Column(length = 100)
  private String complement;

  @Column(nullable = false, length = 100)
  private String neighborhood;

  @Column(nullable = false, length = 100)
  private String city;

  @Column(nullable = false, length = 2)
  private String state;

  @Column(name = "zip_code", nullable = false, length = 8)
  private String zipCode;

  @Column(name = "is_default", nullable = false)
  private boolean isDefault;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  protected Address() {}

  public Address(
      User user,
      String label,
      String street,
      String number,
      String complement,
      String neighborhood,
      String city,
      String state,
      String zipCode,
      boolean isDefault) {
    this.user = user;
    this.label = label;
    this.street = street;
    this.number = number;
    this.complement = complement;
    this.neighborhood = neighborhood;
    this.city = city;
    this.state = state;
    this.zipCode = zipCode;
    this.isDefault = isDefault;
    this.createdAt = Instant.now();
  }

  public Long getId() {
    return id;
  }

  public User getUser() {
    return user;
  }

  public String getLabel() {
    return label;
  }

  public String getStreet() {
    return street;
  }

  public String getNumber() {
    return number;
  }

  public String getComplement() {
    return complement;
  }

  public String getNeighborhood() {
    return neighborhood;
  }

  public String getCity() {
    return city;
  }

  public String getState() {
    return state;
  }

  public String getZipCode() {
    return zipCode;
  }

  public boolean isDefault() {
    return isDefault;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }
}
