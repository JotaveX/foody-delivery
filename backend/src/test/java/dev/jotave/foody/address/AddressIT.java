package dev.jotave.foody.address;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

class AddressIT extends IntegrationTest {

  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};
  private static final ParameterizedTypeReference<List<Map<String, Object>>> JSON_LIST =
      new ParameterizedTypeReference<>() {};

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;

  private Account account;

  @BeforeEach
  void createAccount() {
    account = TestAccounts.create(http);
  }

  @Test
  void listReturnsActiveAddressesWithDefaultFirst() {
    long registered = defaultAddressId();
    long work = idOf(create("Trabalho", false));

    List<Map<String, Object>> list = list();

    assertThat(list).extracting(a -> id(a)).containsExactly(registered, work);
    assertThat(list).extracting(a -> a.get("isDefault")).containsExactly(true, false);
  }

  @Test
  void createReturnsTheAddressAndKeepsTheCurrentDefault() {
    ResponseEntity<Map<String, Object>> response = create("Trabalho", false);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(response.getHeaders().getLocation()).hasPath("/addresses/" + idOf(response));
    assertThat(response.getBody())
        .containsEntry("label", "Trabalho")
        .containsEntry("state", "SP")
        .containsEntry("zipCode", "01310100")
        .containsEntry("isDefault", false);
    assertThat(activeDefaults()).isEqualTo(1);
  }

  @Test
  void createWithMakeDefaultKeepsExactlyOneDefault() {
    long previous = defaultAddressId();

    long created = idOf(create("Trabalho", true));

    assertThat(activeDefaults()).isEqualTo(1);
    assertThat(defaultAddressId()).isEqualTo(created);
    assertThat(list()).extracting(a -> id(a)).containsExactly(created, previous);
  }

  @Test
  void createWithInvalidBodyIsBadRequest() {
    ResponseEntity<Map<String, Object>> response =
        exchange(HttpMethod.POST, "/addresses", Map.of("address", Map.of("street", "")));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(errors(response)).containsKeys("address.street", "address.zipCode");
  }

  @Test
  void updateCreatesANewVersionAndSoftDeletesTheOldOne() {
    long oldId = defaultAddressId();

    ResponseEntity<Map<String, Object>> response =
        exchange(
            HttpMethod.PUT,
            "/addresses/" + oldId,
            TestAccounts.address("Casa nova", "Rua Augusta"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    long newId = idOf(response);
    assertThat(newId).isNotEqualTo(oldId);
    assertThat(response.getBody())
        .containsEntry("street", "Rua Augusta")
        .containsEntry("isDefault", true);

    Map<String, Object> old = jdbc.queryForMap("SELECT * FROM addresses WHERE id = ?", oldId);
    assertThat(old.get("deleted_at")).isNotNull();
    assertThat(old.get("street")).isEqualTo("Avenida Paulista");
    assertThat(list()).extracting(a -> id(a)).containsExactly(newId);
    assertThat(activeDefaults()).isEqualTo(1);
    assertThat(exchange(HttpMethod.PUT, "/addresses/" + oldId, TestAccounts.address("X", "Y")))
        .returns(HttpStatus.NOT_FOUND, ResponseEntity::getStatusCode);
  }

  @Test
  void makeDefaultSwitchesTheDefaultKeepingExactlyOne() {
    long previous = defaultAddressId();
    long work = idOf(create("Trabalho", false));

    ResponseEntity<Map<String, Object>> response =
        exchange(HttpMethod.PATCH, "/addresses/" + work + "/default", null);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).containsEntry("isDefault", true);
    assertThat(activeDefaults()).isEqualTo(1);
    assertThat(defaultAddressId()).isEqualTo(work);
    assertThat(list()).extracting(a -> id(a)).containsExactly(work, previous);

    // Idempotent on the address that already is the default.
    assertThat(exchange(HttpMethod.PATCH, "/addresses/" + work + "/default", null))
        .returns(HttpStatus.OK, ResponseEntity::getStatusCode);
    assertThat(activeDefaults()).isEqualTo(1);
  }

  @Test
  void deleteSoftDeletesANonDefaultAddress() {
    long work = idOf(create("Trabalho", false));

    ResponseEntity<Map<String, Object>> response =
        exchange(HttpMethod.DELETE, "/addresses/" + work, null);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    assertThat(
            jdbc.queryForObject(
                "SELECT deleted_at IS NOT NULL FROM addresses WHERE id = ?", Boolean.class, work))
        .isTrue();
    assertThat(list()).extracting(a -> id(a)).doesNotContain(work);
    assertThat(exchange(HttpMethod.GET, "/addresses/" + work, null))
        .returns(HttpStatus.NOT_FOUND, ResponseEntity::getStatusCode);
  }

  @Test
  void deletingTheDefaultAddressIsAConflict() {
    create("Trabalho", false);
    long defaultId = defaultAddressId();

    ResponseEntity<Map<String, Object>> response =
        exchange(HttpMethod.DELETE, "/addresses/" + defaultId, null);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody())
        .containsEntry("detail", AddressConflictException.DEFAULT_ADDRESS);
    assertThat(list()).hasSize(2);
  }

  @Test
  void deletingTheOnlyAddressIsAConflict() {
    ResponseEntity<Map<String, Object>> response =
        exchange(HttpMethod.DELETE, "/addresses/" + defaultAddressId(), null);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody()).containsEntry("detail", AddressConflictException.ONLY_ADDRESS);
  }

  @Test
  void addressOfAnotherUserIsNotFound() {
    long othersAddress = defaultAddressId();
    account = TestAccounts.create(http);

    for (var request :
        List.of(
            exchange(HttpMethod.GET, "/addresses/" + othersAddress, null),
            exchange(
                HttpMethod.PUT,
                "/addresses/" + othersAddress,
                TestAccounts.address("Invasão", "Rua X")),
            exchange(HttpMethod.PATCH, "/addresses/" + othersAddress + "/default", null),
            exchange(HttpMethod.DELETE, "/addresses/" + othersAddress, null))) {
      assertThat(request.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
      assertThat(request.getBody()).containsEntry("detail", "Endereço não encontrado.");
    }
    assertThat(
            jdbc.queryForObject(
                "SELECT deleted_at IS NULL AND is_default = 1 FROM addresses WHERE id = ?",
                Boolean.class,
                othersAddress))
        .isTrue();
    assertThat(list()).extracting(a -> id(a)).doesNotContain(othersAddress);
  }

  @Test
  void endpointsRequireAuthentication() {
    assertThat(http.getForEntity("/addresses", Map.class).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(
            http.postForEntity(
                    "/addresses", Map.of("address", TestAccounts.address("X", "Y")), Map.class)
                .getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  private ResponseEntity<Map<String, Object>> create(String label, boolean makeDefault) {
    return exchange(
        HttpMethod.POST,
        "/addresses",
        Map.of("address", TestAccounts.address(label, "Rua " + label), "makeDefault", makeDefault));
  }

  private List<Map<String, Object>> list() {
    return http.exchange(
            "/addresses", HttpMethod.GET, new HttpEntity<>(account.headers()), JSON_LIST)
        .getBody();
  }

  private ResponseEntity<Map<String, Object>> exchange(HttpMethod method, String url, Object body) {
    return http.exchange(url, method, new HttpEntity<>(body, account.headers()), JSON);
  }

  private long defaultAddressId() {
    return jdbc.queryForObject(
        """
        SELECT a.id FROM addresses a JOIN users u ON u.id = a.user_id
        WHERE u.email = ? AND a.is_default = 1 AND a.deleted_at IS NULL
        """,
        Long.class,
        account.email());
  }

  private int activeDefaults() {
    return jdbc.queryForObject(
        """
        SELECT count(*) FROM addresses a JOIN users u ON u.id = a.user_id
        WHERE u.email = ? AND a.is_default = 1 AND a.deleted_at IS NULL
        """,
        Integer.class,
        account.email());
  }

  private static long idOf(ResponseEntity<Map<String, Object>> response) {
    return id(response.getBody());
  }

  private static long id(Map<String, Object> json) {
    return ((Number) json.get("id")).longValue();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> errors(ResponseEntity<Map<String, Object>> response) {
    return (Map<String, Object>) response.getBody().get("errors");
  }
}
