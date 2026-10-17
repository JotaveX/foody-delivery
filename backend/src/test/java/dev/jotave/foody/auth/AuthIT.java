package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

class AuthIT extends IntegrationTest {

  private static final String PASSWORD = "s3nha-segura";

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void registerCreatesUserWithoutAddress() {
    String email = uniqueEmail();

    ResponseEntity<Map> response = register(email);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    Map<String, Object> body = map(response.getBody());
    assertThat(body).containsEntry("email", email).containsEntry("name", "Maria Silva");
    assertThat(body).doesNotContainKeys("password", "passwordHash", "tokenVersion");
    assertThat(body).containsEntry("defaultAddress", null);

    Long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
    assertThat(
            jdbc.queryForObject(
                "SELECT password_hash FROM users WHERE id = ?", String.class, userId))
        .startsWith("$2")
        .isNotEqualTo(PASSWORD);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM addresses WHERE user_id = ?", Integer.class, userId))
        .isZero();
  }

  @Test
  void registerWithDuplicateEmailIsConflict() {
    String email = uniqueEmail();
    assertThat(register(email).getStatusCode()).isEqualTo(HttpStatus.CREATED);

    ResponseEntity<Map> response = register(email.toUpperCase());

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody()).containsEntry("detail", "Este e-mail já está cadastrado.");
  }

  @Test
  void loginReturnsTokenThatAuthenticatesMe() {
    String email = uniqueEmail();
    register(email);

    ResponseEntity<Map> login = login(email, PASSWORD);

    assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(login.getBody()).containsKeys("token", "expiresIn", "user");
    assertThat(((Number) login.getBody().get("expiresIn")).longValue()).isPositive();
    assertThat(map(login.getBody().get("user"))).doesNotContainKey("passwordHash");

    ResponseEntity<Map> me = me((String) login.getBody().get("token"));

    assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(me.getBody()).containsEntry("email", email);
    assertThat(map(me.getBody().get("defaultAddress"))).containsEntry("street", "Avenida Paulista");
  }

  @Test
  void loginWithInvalidCredentialsReturnsGenericError() {
    String email = uniqueEmail();
    register(email);

    ResponseEntity<Map> wrongPassword = login(email, "senha-errada");
    ResponseEntity<Map> unknownEmail = login(uniqueEmail(), PASSWORD);

    assertThat(wrongPassword.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(unknownEmail.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(wrongPassword.getBody())
        .containsEntry("detail", "E-mail ou senha inválidos.")
        .isEqualTo(unknownEmail.getBody());
  }

  @Test
  void protectedRouteWithoutTokenIsUnauthorized() {
    ResponseEntity<Map> response = http.getForEntity("/auth/me", Map.class);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(
            response
                .getHeaders()
                .getContentType()
                .isCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .isTrue();
    assertThat(response.getBody()).containsEntry("status", 401).containsKey("detail");
  }

  @Test
  void tokenWithOutdatedTokenVersionIsRejected() {
    String email = uniqueEmail();
    register(email);
    String token = (String) login(email, PASSWORD).getBody().get("token");
    assertThat(me(token).getStatusCode()).isEqualTo(HttpStatus.OK);

    jdbc.update("UPDATE users SET token_version = token_version + 1 WHERE email = ?", email);

    ResponseEntity<Map> response = me(token);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(response.getBody())
        .containsEntry("detail", "Token inválido ou expirado. Faça login novamente.");
  }

  private ResponseEntity<Map> register(String email) {
    var body = new java.util.HashMap<String, Object>();
    body.put("name", "Maria Silva");
    body.put("email", email);
    body.put("password", PASSWORD);
    return http.postForEntity("/auth/register", body, Map.class);
  }

  private ResponseEntity<Map> login(String email, String password) {
    return http.postForEntity(
        "/auth/login", Map.of("email", email, "password", password), Map.class);
  }

  private ResponseEntity<Map> me(String token) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    return http.exchange("/auth/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> map(Object json) {
    return (Map<String, Object>) json;
  }

  private static String uniqueEmail() {
    return "user-" + UUID.randomUUID() + "@example.com";
  }
}
