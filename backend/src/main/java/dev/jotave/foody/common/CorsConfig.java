package dev.jotave.foody.common;

import dev.jotave.foody.idempotency.IdempotencyAspect;
import dev.jotave.foody.ratelimit.RateLimitFilter;
import java.time.Duration;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS for the SPA served from another origin (Cloudflare Pages in production). Picked up by the
 * security chain ({@code http.cors(...)}), so preflights are answered before authentication and
 * even 401/429 responses carry the headers the browser needs to read them.
 *
 * <p>The JWT travels in the Authorization header, never in a cookie: credentials stay disabled.
 */
@Configuration
class CorsConfig {

  @Bean
  CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
    var config = new CorsConfiguration();
    config.setAllowedOrigins(properties.allowedOrigins());
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(
        List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE, IdempotencyAspect.KEY_HEADER));
    config.setExposedHeaders(
        List.of(
            HttpHeaders.LOCATION,
            HttpHeaders.RETRY_AFTER,
            RateLimitFilter.REMAINING_HEADER,
            IdempotencyAspect.REPLAYED_HEADER));
    config.setAllowCredentials(false);
    config.setMaxAge(Duration.ofHours(1));

    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
