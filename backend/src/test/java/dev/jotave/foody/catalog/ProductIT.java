package dev.jotave.foody.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import dev.jotave.foody.support.TestProducts;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

class ProductIT extends IntegrationTest {

  private static final ParameterizedTypeReference<List<Map<String, Object>>> JSON_LIST =
      new ParameterizedTypeReference<>() {};
  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};
  private static final String IMAGE_BASE =
      "https://storage.googleapis.com/bright-torus-356608-foody-images/";

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private StringRedisTemplate redis;
  @MockitoSpyBean private ProductRepository products;

  private Account account;

  @BeforeEach
  void setUp() {
    account = TestAccounts.create(http);
    // Other tests may have filled the cache before inserting their own products.
    Set<String> keys = redis.keys("cache:catalog:*");
    if (!keys.isEmpty()) {
      redis.delete(keys);
    }
    clearInvocations(products);
  }

  @Test
  void listsActiveProductsInMenuOrderWithPublicImageUrls() {
    ResponseEntity<List<Map<String, Object>>> response = get("/products");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    List<Map<String, Object>> catalog = response.getBody();
    assertThat(catalog).hasSizeGreaterThanOrEqualTo(20);
    assertThat(catalog)
        .extracting(p -> p.get("slug"))
        .startsWith("x-burguer", "x-bacon", "cachorro-quente", "batata-frita", "pizza-calabresa");
    assertThat(catalog.getFirst())
        .containsEntry("name", "X-Burguer")
        .containsEntry("category", "LANCHES")
        .containsEntry("price", 24.9)
        .containsEntry("imageUrl", IMAGE_BASE + "catalog/x-burguer.webp")
        .containsKeys("id", "description")
        .doesNotContainKeys("imageKey", "active", "displayOrder");
  }

  @Test
  void responseIsPubliclyCacheable() {
    HttpHeaders headers = get("/products").getHeaders();

    assertThat(headers.getCacheControl()).contains("max-age=300").contains("public");
    assertThat(headers.getPragma()).isNull();
  }

  @Test
  void inactiveProductsAreHidden() {
    long inactive = TestProducts.insert(jdbc, 1000, false);

    assertThat(get("/products").getBody())
        .extracting(p -> ((Number) p.get("id")).longValue())
        .doesNotContain(inactive);
  }

  @Test
  void filtersByCategory() {
    List<Map<String, Object>> pizzas = get("/products?category=PIZZA").getBody();

    assertThat(pizzas)
        .extracting(p -> p.get("slug"))
        .containsExactly("pizza-calabresa", "pizza-mussarela", "pizza-margherita");
    assertThat(pizzas).extracting(p -> p.get("category")).containsOnly("PIZZA");
  }

  @Test
  void unknownCategoryIsBadRequest() {
    ResponseEntity<Map<String, Object>> response =
        http.exchange(
            "/products?category=CHURRASCO",
            HttpMethod.GET,
            new HttpEntity<>(account.headers()),
            JSON);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(response.getBody().get("errors").toString()).contains("category");
  }

  @Test
  void requiresAuthentication() {
    assertThat(http.getForEntity("/products", Map.class).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  @Test
  void repeatedReadsAreServedFromRedisPerCategory() {
    List<Map<String, Object>> first = get("/products?category=JAPONESA").getBody();
    List<Map<String, Object>> second = get("/products?category=JAPONESA").getBody();
    get("/products");
    get("/products");

    assertThat(second).isEqualTo(first);
    verify(products, times(1))
        .findByActiveTrueAndCategoryOrderByDisplayOrderAscIdAsc(ProductCategory.JAPONESA);
    verify(products, times(1)).findByActiveTrueOrderByDisplayOrderAscIdAsc();
    assertThat(redis.hasKey("cache:catalog:JAPONESA")).isTrue();
    assertThat(redis.hasKey("cache:catalog:all")).isTrue();
    assertThat(redis.getExpire("cache:catalog:all")).isGreaterThan(600).isLessThanOrEqualTo(3600);
  }

  private ResponseEntity<List<Map<String, Object>>> get(String url) {
    return http.exchange(url, HttpMethod.GET, new HttpEntity<>(account.headers()), JSON_LIST);
  }
}
