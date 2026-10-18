package dev.jotave.foody.idempotency;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import dev.jotave.foody.support.TestProducts;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

class IdempotencyIT extends IntegrationTest {

  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;

  private Account account;
  private long addressId;

  @BeforeEach
  void createAccount() {
    account = TestAccounts.create(http);
    addressId =
        jdbc.queryForObject(
            "SELECT a.id FROM addresses a JOIN users u ON u.id = a.user_id"
                + " WHERE u.email = ? AND a.is_default = 1 AND a.deleted_at IS NULL",
            Long.class,
            account.email());
  }

  @Test
  void replayReturnsTheSameOrderWithoutCreatingAnother() {
    String key = UUID.randomUUID().toString();

    ResponseEntity<Map<String, Object>> first = createOrder(order("x-burguer"), key);
    ResponseEntity<Map<String, Object>> replay = createOrder(order("x-burguer"), key);

    assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(first.getHeaders().containsKey(IdempotencyAspect.REPLAYED_HEADER)).isFalse();
    assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(replay.getHeaders().getFirst(IdempotencyAspect.REPLAYED_HEADER)).isEqualTo("true");
    assertThat(replay.getHeaders().getLocation()).isEqualTo(first.getHeaders().getLocation());
    assertThat(replay.getBody()).isEqualTo(first.getBody());
    assertThat(ordersOfAccount()).isEqualTo(1);
  }

  @Test
  void sameKeyWithADifferentBodyIsUnprocessable() {
    String key = UUID.randomUUID().toString();
    assertThat(createOrder(order("x-burguer"), key).getStatusCode()).isEqualTo(HttpStatus.CREATED);

    ResponseEntity<Map<String, Object>> response = createOrder(order("x-bacon"), key);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    assertThat(response.getBody())
        .containsEntry(
            "detail", "Esta Idempotency-Key já foi usada em uma requisição com outro conteúdo.");
    assertThat(ordersOfAccount()).isEqualTo(1);
  }

  @Test
  void concurrentRequestsWithTheSameKeyCreateASingleOrder() throws Exception {
    String key = UUID.randomUUID().toString();
    int threads = 8;
    CountDownLatch start = new CountDownLatch(1);
    List<Callable<HttpStatusCode>> calls = new ArrayList<>();
    for (int i = 0; i < threads; i++) {
      calls.add(
          () -> {
            start.await();
            return createOrder(order("x-burguer"), key).getStatusCode();
          });
    }

    List<HttpStatusCode> statuses = new ArrayList<>();
    try (ExecutorService pool = Executors.newFixedThreadPool(threads)) {
      List<Future<HttpStatusCode>> futures = calls.stream().map(pool::submit).toList();
      start.countDown();
      for (Future<HttpStatusCode> future : futures) {
        statuses.add(future.get());
      }
    }

    // Losers either see the first request still running (409) or its stored response (201).
    assertThat(statuses).containsOnly(HttpStatus.CREATED, HttpStatus.CONFLICT);
    assertThat(statuses).contains(HttpStatus.CREATED);
    assertThat(ordersOfAccount()).isEqualTo(1);
  }

  @Test
  void failedRequestReleasesTheKeyForARetry() {
    String key = UUID.randomUUID().toString();
    Map<String, Object> unusableAddress = order("x-burguer");
    unusableAddress.put("addressId", 999_999);

    assertThat(createOrder(unusableAddress, key).getStatusCode())
        .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    ResponseEntity<Map<String, Object>> retry = createOrder(order("x-burguer"), key);

    assertThat(retry.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(retry.getHeaders().containsKey(IdempotencyAspect.REPLAYED_HEADER)).isFalse();
    assertThat(ordersOfAccount()).isEqualTo(1);
  }

  @Test
  void keysAreScopedPerUser() {
    String key = UUID.randomUUID().toString();
    assertThat(createOrder(order("x-burguer"), key).getStatusCode()).isEqualTo(HttpStatus.CREATED);

    Account other = TestAccounts.create(http);
    account = other;
    addressId =
        jdbc.queryForObject(
            "SELECT a.id FROM addresses a JOIN users u ON u.id = a.user_id WHERE u.email = ?",
            Long.class,
            other.email());

    ResponseEntity<Map<String, Object>> response = createOrder(order("x-burguer"), key);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(response.getHeaders().containsKey(IdempotencyAspect.REPLAYED_HEADER)).isFalse();
  }

  @Test
  void withoutTheHeaderEveryRequestCreatesAnOrder() {
    createOrder(order("x-burguer"), null);
    createOrder(order("x-burguer"), null);

    assertThat(ordersOfAccount()).isEqualTo(2);
  }

  @Test
  void malformedKeyIsBadRequest() {
    ResponseEntity<Map<String, Object>> response = createOrder(order("x-burguer"), "not-a-uuid");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody())
        .containsEntry("detail", "O cabeçalho Idempotency-Key deve ser um UUID.");
    assertThat(ordersOfAccount()).isZero();
  }

  private Map<String, Object> order(String productSlug) {
    Map<String, Object> body = new HashMap<>();
    body.put("customerName", "Maria Silva");
    body.put(
        "items", List.of(Map.of("productId", TestProducts.idOf(jdbc, productSlug), "quantity", 1)));
    body.put("addressId", addressId);
    return body;
  }

  private ResponseEntity<Map<String, Object>> createOrder(Map<String, Object> body, String key) {
    HttpHeaders headers = account.headers();
    if (key != null) {
      headers.set(IdempotencyAspect.KEY_HEADER, key);
    }
    return http.exchange("/orders", HttpMethod.POST, new HttpEntity<>(body, headers), JSON);
  }

  private int ordersOfAccount() {
    return jdbc.queryForObject(
        "SELECT count(*) FROM orders o JOIN users u ON u.id = o.created_by WHERE u.email = ?",
        Integer.class,
        account.email());
  }
}
