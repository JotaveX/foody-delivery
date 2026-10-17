package dev.jotave.foody.order;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface OrderRepository extends JpaRepository<Order, Long> {

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
  java.util.Optional<Order> findDetailed(Long id);
}
