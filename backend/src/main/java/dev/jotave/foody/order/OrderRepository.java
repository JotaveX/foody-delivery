package dev.jotave.foody.order;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OrderRepository extends JpaRepository<Order, Long> {

  // Listings show the delivery address: fetch it in the same query (to-one, safe to paginate).
  @Override
  @EntityGraph(attributePaths = "deliveryAddress")
  Page<Order> findAll(Pageable pageable);

  @EntityGraph(attributePaths = "deliveryAddress")
  Page<Order> findByStatus(OrderStatus status, Pageable pageable);

  @Query(
      """
      select h from OrderStatusHistory h join fetch h.changedBy
      where h.order.id = :orderId
      order by h.changedAt, h.id
      """)
  List<OrderStatusHistory> findHistory(Long orderId);

  @EntityGraph(attributePaths = {"deliveryAddress", "createdBy"})
  @Query("select o from Order o where o.id = :id")
  Optional<Order> findDetailed(Long id);
}
