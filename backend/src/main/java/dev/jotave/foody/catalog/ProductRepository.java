package dev.jotave.foody.catalog;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {

  List<Product> findByActiveTrueOrderByDisplayOrderAscIdAsc();

  List<Product> findByActiveTrueAndCategoryOrderByDisplayOrderAscIdAsc(ProductCategory category);

  List<Product> findByIdInAndActiveTrue(Collection<Long> ids);
}
