package dev.jotave.foody.catalog;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param imageBaseUrl public URL prefix of the catalog images; a product's image is {@code
 *     imageBaseUrl + "/" + imageKey}. Reading needs no credentials, in dev as well.
 */
@ConfigurationProperties("app.catalog")
public record CatalogProperties(String imageBaseUrl) {

  public CatalogProperties {
    imageBaseUrl = imageBaseUrl.replaceAll("/+$", "");
  }

  public String imageUrl(String imageKey) {
    return imageBaseUrl + "/" + imageKey;
  }
}
