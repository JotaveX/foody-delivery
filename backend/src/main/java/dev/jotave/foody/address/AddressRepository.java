package dev.jotave.foody.address;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AddressRepository extends JpaRepository<Address, Long> {

  Optional<Address> findByUserIdAndIsDefaultTrueAndDeletedAtIsNull(Long userId);

  /** Active address owned by the user; another user's or a deleted address is "not found". */
  @Query("select a from Address a where a.id = :id and a.user.id = :userId and a.deletedAt is null")
  Optional<Address> findActive(Long id, Long userId);

  @Query(
      """
      select a from Address a
      where a.user.id = :userId and a.deletedAt is null
      order by a.isDefault desc, a.createdAt desc, a.id desc
      """)
  List<Address> findAllActive(Long userId);

  long countByUserIdAndDeletedAtIsNull(Long userId);
}
