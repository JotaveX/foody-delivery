package dev.jotave.foody.catalog;

import java.util.Collection;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {

  private final ProductRepository products;
  private final CatalogProperties properties;

  public CatalogService(ProductRepository products, CatalogProperties properties) {
    this.products = products;
    this.properties = properties;
  }

  /**
   * Active products in menu order, optionally of one category.
   *
   * <p>The catalog is the natural use case for a cache: it is read on every order screen and is
   * practically immutable (it only changes through a migration, and {@link CatalogCacheEvictor}
   * clears it on startup). Hence the long TTL, in contrast to the short-lived order cache.
   */
  @Cacheable(
      cacheNames = CatalogCacheConfig.CATALOG,
      key = "#category == null ? 'all' : #category.name()")
  @Transactional(readOnly = true)
  public List<ProductResponse> list(ProductCategory category) {
    List<Product> result =
        category == null
            ? products.findByActiveTrueOrderByDisplayOrderAscIdAsc()
            : products.findByActiveTrueAndCategoryOrderByDisplayOrderAscIdAsc(category);
    return result.stream().map(this::toResponse).toList();
  }

  /**
   * Active products among {@code ids}, straight from the database: ordering must see the current
   * price and availability, never a cached copy. Missing or inactive ids are simply left out.
   */
  public List<Product> findActive(Collection<Long> ids) {
    return products.findByIdInAndActiveTrue(ids);
  }

  private ProductResponse toResponse(Product product) {
    return new ProductResponse(
        product.getId(),
        product.getSlug(),
        product.getName(),
        product.getDescription(),
        product.getCategory(),
        product.getPrice(),
        properties.imageUrl(product.getImageKey()));
  }
}
