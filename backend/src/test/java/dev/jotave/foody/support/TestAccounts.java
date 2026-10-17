package dev.jotave.foody.support;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** Creates users through the public API and returns ready-to-use bearer headers. */
public final class TestAccounts {

  public static final String PASSWORD = "s3nha-segura";

  private TestAccounts() {}

  public record Account(String email, String token) {
    public HttpHeaders headers() {
      HttpHeaders headers = new HttpHeaders();
      headers.setBearerAuth(token);
      return headers;
    }
  }

  public static Account create(TestRestTemplate http) {
    return create(http, address("Casa", "Avenida Paulista"));
  }

  /** A user who skipped the address at sign-up. */
  public static Account createWithoutAddress(TestRestTemplate http) {
    return create(http, null);
  }

  private static Account create(TestRestTemplate http, Map<String, Object> address) {
    String email = "user-" + UUID.randomUUID() + "@example.com";
    Map<String, Object> body = new HashMap<>();
    body.put("name", "Maria Silva");
    body.put("email", email);
    body.put("password", PASSWORD);
    body.put("address", address);
    ResponseEntity<Map> registered = http.postForEntity("/auth/register", body, Map.class);
    if (registered.getStatusCode() != HttpStatus.CREATED) {
      throw new IllegalStateException("Registration failed: " + registered);
    }
    Map<?, ?> login =
        http.postForObject("/auth/login", Map.of("email", email, "password", PASSWORD), Map.class);
    return new Account(email, (String) login.get("token"));
  }

  public static Map<String, Object> address(String label, String street) {
    return Map.of(
        "label", label,
        "street", street,
        "number", "1000",
        "neighborhood", "Bela Vista",
        "city", "São Paulo",
        "state", "sp",
        "zipCode", "01310-100");
  }
}
