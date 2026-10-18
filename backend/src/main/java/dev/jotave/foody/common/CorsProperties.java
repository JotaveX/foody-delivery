package dev.jotave.foody.common;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Browser origins allowed to call the API cross-origin and to open the {@code /ws} WebSocket.
 *
 * @param allowedOrigins exact origins (scheme, host and port), e.g. {@code
 *     https://foody.jotave.dev}
 * @param allowedOriginPatterns Spring origin patterns, where {@code *} matches part of the host,
 *     e.g. {@code https://*.foody.pages.dev} for Cloudflare Pages previews
 */
@ConfigurationProperties("app.cors")
public record CorsProperties(List<String> allowedOrigins, List<String> allowedOriginPatterns) {

  public CorsProperties {
    allowedOrigins = nonBlank(allowedOrigins);
    allowedOriginPatterns = nonBlank(allowedOriginPatterns);
  }

  // An empty environment variable binds to [""], which must mean "none", not "the empty origin".
  private static List<String> nonBlank(List<String> values) {
    return values == null
        ? List.of()
        : values.stream().map(String::trim).filter(v -> !v.isEmpty()).toList();
  }
}
