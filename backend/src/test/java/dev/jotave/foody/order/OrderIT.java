package dev.jotave.foody.order;

import static dev.jotave.foody.order.OrderStatus.EM_PREPARO;
import static dev.jotave.foody.order.OrderStatus.ENTREGUE;
import static dev.jotave.foody.order.OrderStatus.RECEBIDO;
import static dev.jotave.foody.order.OrderStatus.SAIU_PARA_ENTREGA;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.RecordedOrderEvents;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import java.time.Instant;
import java.util.HashMap;
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

class OrderIT extends IntegrationTest {

  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};
  private static final ParameterizedTypeReference<List<Map<String, Object>>> JSON_LIST =
      new ParameterizedTypeReference<>() {};

  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private RecordedOrderEvents events;

  private Account account;
  private long defaultAddressId;

  @BeforeEach
  void createAccount() {
    account = TestAccounts.create(http);
    defaultAddressId = defaultAddressIdOf(account);
  }

  @Test
  void happyPathFromCreationToDelivery() {
    ResponseEntity<Map<String, Object>> created = createOrder(withAddressId(defaultAddressId));

    assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    long orderId = id(created.getBody());
    assertThat(created.getHeaders().getLocation()).hasPath("/orders/" + orderId);
    assertThat(created.getBody())
        .containsEntry("status", "RECEBIDO")
        .containsEntry("customerName", "Maria Silva")
        .containsEntry("totalAmount", 33.9);

    for (OrderStatus next : List.of(EM_PREPARO, SAIU_PARA_ENTREGA, ENTREGUE)) {
      ResponseEntity<Map<String, Object>> changed = changeStatus(orderId, next.name());
      assertThat(changed.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(changed.getBody()).containsEntry("status", next.name());
    }

    assertThat(get("/orders/" + orderId).getBody()).containsEntry("status", "ENTREGUE");

    List<Map<String, Object>> history = history(orderId).getBody();
    assertThat(history)
        .extracting(h -> h.get("fromStatus"), h -> h.get("toStatus"))
        .containsExactly(
            tuple(null, "RECEBIDO"),
            tuple("RECEBIDO", "EM_PREPARO"),
            tuple("EM_PREPARO", "SAIU_PARA_ENTREGA"),
            tuple("SAIU_PARA_ENTREGA", "ENTREGUE"));
    assertThat(history)
        .extracting(h -> Instant.parse((String) h.get("changedAt")))
        .isSortedAccordingTo(Instant::compareTo);
    assertThat(history)
        .allSatisfy(h -> assertThat(map(h.get("changedBy"))).containsEntry("name", "Maria Silva"));

    assertThat(events.forOrder(orderId))
        .extracting(OrderChangedEvent::previousStatus, OrderChangedEvent::status)
        .containsExactly(
            tuple(null, RECEBIDO),
            tuple(RECEBIDO, EM_PREPARO),
            tuple(EM_PREPARO, SAIU_PARA_ENTREGA),
            tuple(SAIU_PARA_ENTREGA, ENTREGUE));
    assertThat(events.forOrder(orderId).getFirst().isCreation()).isTrue();
  }

  @Test
  void orderWithAddressIdShowsItemsTotalAndDeliveryAddress() {
    long orderId = id(createOrder(withAddressId(defaultAddressId)).getBody());

    Map<String, Object> order = get("/orders/" + orderId).getBody();

    assertThat(order).containsEntry("totalAmount", 33.9);
    assertThat(list(order.get("items")))
        .extracting(i -> i.get("name"), i -> i.get("quantity"), i -> i.get("subtotal"))
        .containsExactly(tuple("X-Burger", 2, 25.0), tuple("Refrigerante", 1, 8.9));
    assertThat(map(order.get("deliveryAddress")))
        .containsEntry("id", (int) defaultAddressId)
        .containsEntry("street", "Avenida Paulista")
        .containsEntry("zipCode", "01310100");
    assertThat(map(order.get("createdBy"))).containsEntry("name", "Maria Silva");
  }

  @Test
  void orderWithNewAddressSavedAsDefault() {
    Map<String, Object> body = baseOrder();
    body.put("newAddress", TestAccounts.address("Trabalho", "Rua Augusta"));
    body.put("saveAsDefault", true);

    ResponseEntity<Map<String, Object>> created = createOrder(body);

    assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    long newAddressId = id(map(created.getBody().get("deliveryAddress")));
    assertThat(newAddressId).isNotEqualTo(defaultAddressId);
    assertThat(map(created.getBody().get("deliveryAddress")))
        .containsEntry("street", "Rua Augusta");
    assertThat(defaultAddressIdOf(account)).isEqualTo(newAddressId);
    assertThat(activeDefaults(account)).isEqualTo(1);
    assertThat(activeAddresses(account)).isEqualTo(2);
  }

  @Test
  void orderWithNewAddressKeepsTheDefaultUnlessAsked() {
    Map<String, Object> body = baseOrder();
    body.put("newAddress", TestAccounts.address("Trabalho", "Rua Augusta"));

    assertThat(createOrder(body).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    assertThat(defaultAddressIdOf(account)).isEqualTo(defaultAddressId);
    assertThat(activeAddresses(account)).isEqualTo(2);
  }

  @Test
  void addressOfAnotherUserIsUnprocessable() {
    long othersAddress = defaultAddressIdOf(TestAccounts.create(http));
    int ordersBefore = countOrders();

    ResponseEntity<Map<String, Object>> response = createOrder(withAddressId(othersAddress));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    assertThat(map(response.getBody().get("errors"))).containsKey("addressId");
    assertThat(countOrders()).isEqualTo(ordersBefore);
  }

  @Test
  void deletedAddressIsUnprocessable() {
    long work =
        id(
            exchange(
                    HttpMethod.POST,
                    "/addresses",
                    Map.of("address", TestAccounts.address("Trabalho", "Rua Augusta")))
                .getBody());
    exchange(HttpMethod.DELETE, "/addresses/" + work, null);

    assertThat(createOrder(withAddressId(work)).getStatusCode())
        .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
  }

  @Test
  void sendingBothOrNeitherAddressFormIsBadRequest() {
    Map<String, Object> both = withAddressId(defaultAddressId);
    both.put("newAddress", TestAccounts.address("Trabalho", "Rua Augusta"));
    Map<String, Object> neither = baseOrder();

    for (Map<String, Object> body : List.of(both, neither)) {
      ResponseEntity<Map<String, Object>> response = createOrder(body);
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(map(response.getBody().get("errors")))
          .containsEntry("addressId", "Informe exatamente um entre addressId e newAddress.");
    }
  }

  @Test
  void invalidItemsAreBadRequest() {
    Map<String, Object> empty = withAddressId(defaultAddressId);
    empty.put("items", List.of());
    Map<String, Object> badItem = withAddressId(defaultAddressId);
    badItem.put("items", List.of(Map.of("name", "", "quantity", 0, "unitPrice", 1.999)));

    assertThat(map(createOrder(empty).getBody().get("errors"))).containsKey("items");
    ResponseEntity<Map<String, Object>> response = createOrder(badItem);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(map(response.getBody().get("errors")))
        .containsKeys("items[0].name", "items[0].quantity", "items[0].unitPrice");
  }

  @Test
  void orderKeepsShowingItsAddressAfterItIsEditedInTheProfile() {
    long orderId = id(createOrder(withAddressId(defaultAddressId)).getBody());

    exchange(
        HttpMethod.PUT, "/addresses/" + defaultAddressId, TestAccounts.address("Casa", "Rua Nova"));

    Map<String, Object> deliveryAddress =
        map(get("/orders/" + orderId).getBody().get("deliveryAddress"));
    assertThat(deliveryAddress)
        .containsEntry("id", (int) defaultAddressId)
        .containsEntry("street", "Avenida Paulista");
  }

  @Test
  void invalidTransitionIsAConflictWithBothStatuses() {
    long orderId = id(createOrder(withAddressId(defaultAddressId)).getBody());

    ResponseEntity<Map<String, Object>> response = changeStatus(orderId, "ENTREGUE");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody())
        .containsEntry("currentStatus", "RECEBIDO")
        .containsEntry("requestedStatus", "ENTREGUE")
        .containsEntry("detail", "Não é possível alterar o status de RECEBIDO para ENTREGUE.");
    assertThat(get("/orders/" + orderId).getBody()).containsEntry("status", "RECEBIDO");
    assertThat(history(orderId).getBody()).hasSize(1);
    assertThat(events.forOrder(orderId)).hasSize(1);
  }

  @Test
  void unknownStatusIsBadRequest() {
    long orderId = id(createOrder(withAddressId(defaultAddressId)).getBody());

    ResponseEntity<Map<String, Object>> unknown = changeStatus(orderId, "VOANDO");
    ResponseEntity<Map<String, Object>> missing =
        exchange(HttpMethod.PATCH, "/orders/" + orderId + "/status", Map.of());

    assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(unknown.getBody())
        .containsEntry("detail", "Valor inválido para o campo status: VOANDO.");
    assertThat((String) map(unknown.getBody().get("errors")).get("status")).contains("EM_PREPARO");
    assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(map(missing.getBody().get("errors"))).containsKey("status");
  }

  @Test
  void unknownOrderIsNotFound() {
    for (ResponseEntity<?> response :
        List.of(
            get("/orders/999999"),
            changeStatus(999999, "EM_PREPARO"),
            exchange(HttpMethod.GET, "/orders/999999/history", null))) {
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
    assertThat(get("/orders/999999").getBody()).containsEntry("detail", "Pedido não encontrado.");
  }

  @Test
  void listFiltersByStatusAndPaginatesNewestFirst() {
    long first = id(createOrder(withAddressId(defaultAddressId)).getBody());
    long second = id(createOrder(withAddressId(defaultAddressId)).getBody());
    long third = id(createOrder(withAddressId(defaultAddressId)).getBody());
    changeStatus(second, "EM_PREPARO");

    Map<String, Object> preparing = get("/orders?status=EM_PREPARO&size=100").getBody();
    List<Map<String, Object>> preparingContent = list(preparing.get("content"));
    assertThat(preparingContent).extracting(o -> o.get("status")).containsOnly("EM_PREPARO");
    assertThat(preparingContent)
        .extracting(o -> id(o))
        .contains(second)
        .doesNotContain(first, third);

    Map<String, Object> page = get("/orders?size=2").getBody();
    assertThat(page).containsEntry("page", 0).containsEntry("size", 2);
    assertThat(((Number) page.get("totalElements")).longValue()).isGreaterThanOrEqualTo(3);
    List<Map<String, Object>> content = list(page.get("content"));
    assertThat(content).extracting(o -> id(o)).containsExactly(third, second);
    assertThat(content.getFirst())
        .containsEntry("itemCount", 2)
        .containsEntry("totalAmount", 33.9)
        .doesNotContainKey("items");

    assertThat(list(get("/orders?size=2&page=1").getBody().get("content")))
        .extracting(o -> id(o))
        .startsWith(first);
  }

  @Test
  void listWithUnknownStatusIsBadRequest() {
    ResponseEntity<Map<String, Object>> response = get("/orders?status=VOANDO");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(map(response.getBody().get("errors"))).containsKey("status");
  }

  @Test
  void endpointsRequireAuthentication() {
    assertThat(http.getForEntity("/orders", Map.class).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(http.postForEntity("/orders", baseOrder(), Map.class).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
  }

  private Map<String, Object> baseOrder() {
    Map<String, Object> body = new HashMap<>();
    body.put("customerName", "Maria Silva");
    body.put(
        "items",
        List.of(
            Map.of("name", "X-Burger", "quantity", 2, "unitPrice", 12.50),
            Map.of("name", "Refrigerante", "quantity", 1, "unitPrice", 8.90)));
    return body;
  }

  private Map<String, Object> withAddressId(long addressId) {
    Map<String, Object> body = baseOrder();
    body.put("addressId", addressId);
    return body;
  }

  private ResponseEntity<Map<String, Object>> createOrder(Map<String, Object> body) {
    return exchange(HttpMethod.POST, "/orders", body);
  }

  private ResponseEntity<Map<String, Object>> changeStatus(long orderId, String status) {
    return exchange(HttpMethod.PATCH, "/orders/" + orderId + "/status", Map.of("status", status));
  }

  private ResponseEntity<List<Map<String, Object>>> history(long orderId) {
    return http.exchange(
        "/orders/" + orderId + "/history",
        HttpMethod.GET,
        new HttpEntity<>(account.headers()),
        JSON_LIST);
  }

  private ResponseEntity<Map<String, Object>> get(String url) {
    return exchange(HttpMethod.GET, url, null);
  }

  private ResponseEntity<Map<String, Object>> exchange(HttpMethod method, String url, Object body) {
    return http.exchange(url, method, new HttpEntity<>(body, account.headers()), JSON);
  }

  private long defaultAddressIdOf(Account owner) {
    return jdbc.queryForObject(
        """
        SELECT a.id FROM addresses a JOIN users u ON u.id = a.user_id
        WHERE u.email = ? AND a.is_default = 1 AND a.deleted_at IS NULL
        """,
        Long.class,
        owner.email());
  }

  private int activeDefaults(Account owner) {
    return countAddresses(owner, "AND a.is_default = 1");
  }

  private int activeAddresses(Account owner) {
    return countAddresses(owner, "");
  }

  private int countAddresses(Account owner, String extraCondition) {
    return jdbc.queryForObject(
        "SELECT count(*) FROM addresses a JOIN users u ON u.id = a.user_id"
            + " WHERE u.email = ? AND a.deleted_at IS NULL "
            + extraCondition,
        Integer.class,
        owner.email());
  }

  private int countOrders() {
    return jdbc.queryForObject("SELECT count(*) FROM orders", Integer.class);
  }

  private static long id(Map<String, Object> json) {
    return ((Number) json.get("id")).longValue();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> map(Object json) {
    return (Map<String, Object>) json;
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> list(Object json) {
    return (List<Map<String, Object>>) json;
  }
}
