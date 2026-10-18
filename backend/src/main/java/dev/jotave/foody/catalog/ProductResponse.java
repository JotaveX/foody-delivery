package dev.jotave.foody.catalog;

import java.math.BigDecimal;

public record ProductResponse(
    Long id,
    String slug,
    String name,
    String description,
    ProductCategory category,
    BigDecimal price,
    String imageUrl) {}
