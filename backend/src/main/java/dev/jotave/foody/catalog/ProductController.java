package dev.jotave.foody.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only catalog: products are reference data, there are no write routes. */
@RestController
@RequestMapping("/products")
@SecurityRequirement(name = "bearer")
public class ProductController {

  // The catalog is the same for every user, so browsers and shared caches may keep it for a while
  // (an explicit Cache-Control also stops Spring Security from writing its no-store default).
  private static final CacheControl CACHE_CONTROL =
      CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();

  private final CatalogService catalogService;

  public ProductController(CatalogService catalogService) {
    this.catalogService = catalogService;
  }

  @Operation(summary = "Active products in menu order")
  @GetMapping
  public ResponseEntity<List<ProductResponse>> list(
      @Parameter(description = "Only products of this category") @RequestParam(required = false)
          ProductCategory category) {
    return ResponseEntity.ok().cacheControl(CACHE_CONTROL).body(catalogService.list(category));
  }
}
