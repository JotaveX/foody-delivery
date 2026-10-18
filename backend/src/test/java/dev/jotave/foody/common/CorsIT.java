package dev.jotave.foody.common;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Uses the dev default for {@code app.cors.allowed-origins} (the Vite dev server). */
class CorsIT extends IntegrationTest {

  private static final String ALLOWED_ORIGIN = "http://localhost:5173";

  @Autowired private TestRestTemplate http;

  @Test
  void preflightFromAllowedOriginIsAnsweredWithoutAuthentication() {
    ResponseEntity<String> response =
        preflight(ALLOWED_ORIGIN, "POST", "authorization,content-type,idempotency-key");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    HttpHeaders headers = response.getHeaders();
    assertThat(headers.getAccessControlAllowOrigin()).isEqualTo(ALLOWED_ORIGIN);
    assertThat(headers.getAccessControlAllowHeaders())
        .map(String::toLowerCase)
        .contains("authorization", "content-type", "idempotency-key");
    assertThat(headers.getAccessControlAllowCredentials()).isFalse();
  }

  @Test
  void preflightFromAnotherOriginIsRejected() {
    ResponseEntity<String> response = preflight("https://evil.example", "POST", "content-type");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(response.getHeaders().getAccessControlAllowOrigin()).isNull();
  }

  @Test
  void errorResponsesExposeTheHeadersTheSpaReads() {
    var headers = new HttpHeaders();
    headers.setOrigin(ALLOWED_ORIGIN);
    headers.setContentType(MediaType.APPLICATION_JSON);
    var body = Map.of("email", "nobody@example.com", "password", "wrong-password");

    ResponseEntity<String> response =
        http.exchange(
            "/auth/login", HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getHeaders().getAccessControlAllowOrigin()).isEqualTo(ALLOWED_ORIGIN);
    assertThat(response.getHeaders().getAccessControlExposeHeaders())
        .containsExactlyInAnyOrder(
            "Location", "Retry-After", "X-RateLimit-Remaining", "Idempotent-Replayed");
  }

  private ResponseEntity<String> preflight(String origin, String method, String requestHeaders) {
    var headers = new HttpHeaders();
    headers.setOrigin(origin);
    headers.set(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, method);
    headers.set(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, requestHeaders);
    return http.exchange("/orders", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
  }
}
