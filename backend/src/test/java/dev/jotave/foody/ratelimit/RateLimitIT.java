package dev.jotave.foody.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

/**
 * Real limits on their own context. The test client is a trusted proxy here, so each test picks its
 * own client IP through X-Forwarded-For and starts with full buckets.
 */
@TestPropertySource(
    properties = {
      "app.rate-limit.trusted-proxies=127.0.0.1,::1",
      "app.rate-limit.per-ip.login.capacity=5",
      "app.rate-limit.per-ip.register.capacity=3",
      "app.rate-limit.per-user.capacity=5",
      "app.rate-limit.login-failures-per-account.capacity=8"
    })
class RateLimitIT extends IntegrationTest {

  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};
  private static final AtomicInteger NEXT_IP = new AtomicInteger(1);
  private static final String PASSWORD = "s3nha-segura";

  @Autowired private TestRestTemplate http;

  @Test
  void loginIsLimitedPerIpAndAnswers429WithRetryAfter() {
    String ip = uniqueIp();
    for (int attempt = 1; attempt <= 5; attempt++) {
      ResponseEntity<Map<String, Object>> response = login(ip, "nobody@example.com");
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertThat(response.getHeaders().getFirst(RateLimitFilter.REMAINING_HEADER))
          .isEqualTo(String.valueOf(5 - attempt));
    }

    ResponseEntity<Map<String, Object>> limited = login(ip, "nobody@example.com");

    assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    assertThat(
            limited
                .getHeaders()
                .getContentType()
                .isCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .isTrue();
    assertThat(Long.parseLong(limited.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)))
        .isBetween(1L, 60L);
    assertThat(limited.getBody()).containsEntry("status", 429);
    assertThat((String) limited.getBody().get("detail")).startsWith("Muitas requisições.");

    // Another client is not affected.
    assertThat(login(uniqueIp(), "nobody@example.com").getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void failedLoginsAreLimitedPerAccountAcrossIps() {
    String email = uniqueEmail();
    register(uniqueIp(), email);
    for (int attempt = 1; attempt <= 8; attempt++) {
      // A fresh IP each time: the per-IP limit never kicks in.
      assertThat(login(uniqueIp(), email, "senha-errada").getStatusCode())
          .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    ResponseEntity<Map<String, Object>> limited = login(uniqueIp(), email, PASSWORD);

    // Even the right password waits: otherwise the 9th guess would still be tested.
    assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    assertThat(Long.parseLong(limited.getHeaders().getFirst(HttpHeaders.RETRY_AFTER))).isPositive();
    assertThat((String) limited.getBody().get("detail"))
        .startsWith("Muitas tentativas de login para este e-mail.");
    // Unknown e-mails are limited the same way, so a 429 does not reveal accounts.
    String unknown = uniqueEmail();
    for (int attempt = 1; attempt <= 8; attempt++) {
      login(uniqueIp(), unknown, PASSWORD);
    }
    assertThat(login(uniqueIp(), unknown, PASSWORD).getStatusCode())
        .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    // Other accounts are not affected.
    String other = uniqueEmail();
    register(uniqueIp(), other);
    assertThat(login(uniqueIp(), other, PASSWORD).getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void registerIsLimitedPerIp() {
    String ip = uniqueIp();
    for (int attempt = 1; attempt <= 3; attempt++) {
      assertThat(register(ip).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    assertThat(register(ip).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
  }

  @Test
  void authenticatedApiIsLimitedPerUser() {
    String ip = uniqueIp();
    String email = (String) register(ip).getBody().get("email");
    String token =
        (String)
            post("/auth/login", ip, Map.of("email", email, "password", "s3nha-segura"))
                .getBody()
                .get("token");

    for (int call = 1; call <= 5; call++) {
      ResponseEntity<Map<String, Object>> response = get("/orders", token);
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(response.getHeaders().getFirst(RateLimitFilter.REMAINING_HEADER))
          .isEqualTo(String.valueOf(5 - call));
    }

    ResponseEntity<Map<String, Object>> limited = get("/orders", token);
    assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    assertThat(limited.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isNotBlank();
  }

  private ResponseEntity<Map<String, Object>> login(String ip, String email) {
    return login(ip, email, "senha-errada");
  }

  private ResponseEntity<Map<String, Object>> login(String ip, String email, String password) {
    return post("/auth/login", ip, Map.of("email", email, "password", password));
  }

  private ResponseEntity<Map<String, Object>> register(String ip) {
    return register(ip, uniqueEmail());
  }

  private ResponseEntity<Map<String, Object>> register(String ip, String email) {
    Map<String, Object> body = Map.of("name", "Maria Silva", "email", email, "password", PASSWORD);
    return post("/auth/register", ip, body);
  }

  private static String uniqueEmail() {
    return "user-" + UUID.randomUUID() + "@example.com";
  }

  private ResponseEntity<Map<String, Object>> post(String url, String ip, Object body) {
    HttpHeaders headers = new HttpHeaders();
    headers.set(ClientIpResolver.X_FORWARDED_FOR, ip);
    return http.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), JSON);
  }

  private ResponseEntity<Map<String, Object>> get(String url, String token) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    return http.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), JSON);
  }

  /** Addresses from TEST-NET-3 (203.0.113.0/24), unique per test in this JVM. */
  private static String uniqueIp() {
    int n = NEXT_IP.getAndIncrement();
    return "203.0.%d.%d".formatted(113 + n / 250, n % 250 + 1);
  }
}
