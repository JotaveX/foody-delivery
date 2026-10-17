package dev.jotave.foody.address;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AddressRepository extends JpaRepository<Address, Long> {

  Optional<Address> findByUserIdAndIsDefaultTrueAndDeletedAtIsNull(Long userId);
}
