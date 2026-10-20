package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import java.net.HttpCookie;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

class RefreshTokenIT extends IntegrationTest {

  private static final String PASSWORD = "s3nha-segura";
  private static final String EXPIRED_DETAIL = "Sessão expirada. Faça login novamente.";

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;

  private String email;

  @BeforeEach
  void registerUser() {
    email = "user-" + UUID.randomUUID() + "@example.com";
    var body = Map.of("name", "Maria Silva", "email", email, "password", PASSWORD);
    assertThat(http.postForEntity("/auth/register", body, Map.class).getStatusCode())
        .isEqualTo(HttpStatus.CREATED);
  }

  @Test
  void loginSetsTheRefreshTokenAsAnHttpOnlyCookieScopedToAuth() {
    ResponseEntity<Map> login = login();

    assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(((Number) login.getBody().get("refreshExpiresIn")).longValue())
        .isEqualTo(7 * 24 * 3600);
    assertThat(login.getBody()).doesNotContainKey("refreshToken");
    String setCookie = login.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
    assertThat(setCookie)
        .startsWith(RefreshTokenCookie.NAME + "=")
        .contains("Path=/auth", "Max-Age=604800", "HttpOnly", "SameSite=Strict");
  }

  @Test
  void refreshIssuesAWorkingAccessTokenAndRotatesTheCookie() {
    String first = refreshCookie(login());

    ResponseEntity<Map> refreshed = refresh(first);

    assertThat(refreshed.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(refreshed.getBody()).containsKeys("token", "expiresIn", "refreshExpiresIn", "user");
    assertThat(me((String) refreshed.getBody().get("token")).getStatusCode())
        .isEqualTo(HttpStatus.OK);
    String second = refreshCookie(refreshed);
    assertThat(second).isNotEqualTo(first);
    assertThat(refresh(second).getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void reusingARotatedTokenRevokesTheWholeLogin() {
    String first = refreshCookie(login());
    String second = refreshCookie(refresh(first));

    ResponseEntity<Map> reused = refresh(first);

    assertThat(reused.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(reused.getBody()).containsEntry("detail", EXPIRED_DETAIL);
    assertThat(refresh(second).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void reuseRevokesOnlyThatLogin() {
    String first = refreshCookie(login());
    String otherDevice = refreshCookie(login());
    refresh(first);

    refresh(first);

    assertThat(refresh(otherDevice).getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void logoutRevokesTheRefreshTokenAndClearsTheCookie() {
    String token = refreshCookie(login());

    ResponseEntity<Void> logout =
        http.exchange("/auth/logout", HttpMethod.POST, withCookie(token), Void.class);

    assertThat(logout.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    assertThat(logout.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");
    assertThat(refresh(token).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void logoutWithoutCookieIsStillNoContent() {
    assertThat(http.postForEntity("/auth/logout", null, Void.class).getStatusCode())
        .isEqualTo(HttpStatus.NO_CONTENT);
  }

  @Test
  void aPasswordChangeRevokesRefreshTokensLikeJwts() {
    String token = refreshCookie(login());

    jdbc.update("UPDATE users SET token_version = token_version + 1 WHERE email = ?", email);

    assertThat(refresh(token).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void refreshWithoutOrWithAnUnknownCookieIsUnauthorizedAndClearsIt() {
    ResponseEntity<Map> missing = http.postForEntity("/auth/refresh", null, Map.class);
    ResponseEntity<Map> unknown = refresh("not-a-real-token");

    for (ResponseEntity<Map> response : java.util.List.of(missing, unknown)) {
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      assertThat(response.getBody()).containsEntry("detail", EXPIRED_DETAIL);
      assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");
    }
  }

  private ResponseEntity<Map> login() {
    return http.postForEntity(
        "/auth/login", Map.of("email", email, "password", PASSWORD), Map.class);
  }

  private ResponseEntity<Map> refresh(String refreshToken) {
    return http.exchange("/auth/refresh", HttpMethod.POST, withCookie(refreshToken), Map.class);
  }

  private ResponseEntity<Map> me(String token) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    return http.exchange("/auth/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
  }

  private static HttpEntity<Void> withCookie(String refreshToken) {
    HttpHeaders headers = new HttpHeaders();
    headers.add(HttpHeaders.COOKIE, RefreshTokenCookie.NAME + "=" + refreshToken);
    return new HttpEntity<>(headers);
  }

  private static String refreshCookie(ResponseEntity<?> response) {
    String setCookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
    assertThat(setCookie).as("Set-Cookie").isNotNull();
    return HttpCookie.parse(setCookie).getFirst().getValue();
  }
}
