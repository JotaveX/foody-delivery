package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import dev.jotave.foody.support.TestProducts;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

class OrderCacheIT extends IntegrationTest {

  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};

  @Autowired private TestRestTemplate http;
  @Autowired private StringRedisTemplate redis;
  @Autowired private JdbcTemplate jdbc;
  @MockitoSpyBean private OrderRepository orders;
  @MockitoSpyBean private RedisConnectionFactory redisConnectionFactory;

  private Account account;
  private long orderId;

  @BeforeEach
  void createOrder() {
    account = TestAccounts.create(http);
    List<?> addresses =
        http.exchange("/addresses", HttpMethod.GET, new HttpEntity<>(account.headers()), List.class)
            .getBody();
    Map<String, Object> body =
        Map.of(
            "customerName", "Maria Silva",
            "addressId", ((Map<?, ?>) addresses.getFirst()).get("id"),
            "items",
                List.of(Map.of("productId", TestProducts.idOf(jdbc, "x-burguer"), "quantity", 2)));
    orderId = ((Number) exchange(HttpMethod.POST, "/orders", body).getBody().get("id")).longValue();
    clearInvocations(orders);
  }

  @Test
  void secondReadIsServedFromTheCache() {
    ResponseEntity<Map<String, Object>> first = get();
    ResponseEntity<Map<String, Object>> second = get();

    assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(second.getBody()).isEqualTo(first.getBody()).containsEntry("totalAmount", 49.8);
    verify(orders, times(1)).findDetailed(orderId);
    assertThat(redis.hasKey(cacheKey())).isTrue();
    assertThat(redis.getExpire(cacheKey())).isPositive().isLessThanOrEqualTo(600);
  }

  @Test
  void statusChangeEvictsTheCachedOrder() {
    get();
    assertThat(redis.hasKey(cacheKey())).isTrue();

    exchange(HttpMethod.PATCH, "/orders/" + orderId + "/status", Map.of("status", "EM_PREPARO"));

    assertThat(redis.hasKey(cacheKey())).isFalse();
    clearInvocations(orders);
    assertThat(get().getBody()).containsEntry("status", "EM_PREPARO");
    verify(orders, times(1)).findDetailed(orderId);
  }

  @Test
  void rejectedStatusChangeKeepsTheCachedOrder() {
    get();

    ResponseEntity<Map<String, Object>> rejected =
        exchange(HttpMethod.PATCH, "/orders/" + orderId + "/status", Map.of("status", "ENTREGUE"));

    assertThat(rejected.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(redis.hasKey(cacheKey())).isTrue();
  }

  @Test
  void readFallsBackToTheDatabaseWhenRedisIsDown() {
    // Only the cache goes through this factory on a GET (the rate limiter has its own client).
    doThrow(new RedisConnectionFailureException("Redis is down"))
        .when(redisConnectionFactory)
        .getConnection();

    ResponseEntity<Map<String, Object>> first = get();
    ResponseEntity<Map<String, Object>> second = get();

    assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(second.getBody()).containsEntry("id", (int) orderId);
    verify(orders, times(2)).findDetailed(anyLong());
  }

  private String cacheKey() {
    return "cache:" + OrderCacheConfig.ORDER_DETAILS + ":" + orderId;
  }

  private ResponseEntity<Map<String, Object>> get() {
    return exchange(HttpMethod.GET, "/orders/" + orderId, null);
  }

  private ResponseEntity<Map<String, Object>> exchange(
      HttpMethod method, String path, Object body) {
    return http.exchange(path, method, new HttpEntity<>(body, account.headers()), JSON);
  }
}
