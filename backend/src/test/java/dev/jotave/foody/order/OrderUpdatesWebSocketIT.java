package dev.jotave.foody.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import dev.jotave.foody.support.TestProducts;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

class OrderUpdatesWebSocketIT extends IntegrationTest {

  private static final ParameterizedTypeReference<Map<String, Object>> JSON =
      new ParameterizedTypeReference<>() {};

  @LocalServerPort private int port;
  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private SimpleBrokerMessageHandler broker;

  private WebSocketStompClient stompClient;
  private Account account;

  @BeforeEach
  void setUp() {
    stompClient = new WebSocketStompClient(new StandardWebSocketClient());
    stompClient.setMessageConverter(new MappingJackson2MessageConverter());
    account = TestAccounts.create(http);
  }

  @AfterEach
  void tearDown() {
    stompClient.stop();
  }

  @Test
  void statusChangeIsPushedToSubscribers() throws Exception {
    long orderId = createOrder();
    StompSession session = connect("Bearer " + account.token());
    BlockingQueue<Map<String, Object>> detail = subscribe(session, "/topic/orders/" + orderId);
    BlockingQueue<Map<String, Object>> all = subscribe(session, "/topic/orders");

    ResponseEntity<Map<String, Object>> changed =
        http.exchange(
            "/orders/" + orderId + "/status",
            HttpMethod.PATCH,
            new HttpEntity<>(Map.of("status", "EM_PREPARO"), account.headers()),
            JSON);
    assertThat(changed.getStatusCode()).isEqualTo(HttpStatus.OK);

    Map<String, Object> pushed = detail.poll(5, TimeUnit.SECONDS);
    assertThat(pushed)
        .isNotNull()
        .containsEntry("id", (int) orderId)
        .containsEntry("status", "EM_PREPARO")
        .containsEntry("customerName", "Maria Silva")
        .containsKeys("items", "deliveryAddress", "totalAmount", "updatedAt");
    // The same snapshot also goes to the topic the order list listens on.
    assertThat(all.poll(5, TimeUnit.SECONDS)).containsEntry("status", "EM_PREPARO");
    session.disconnect();
  }

  @Test
  void connectWithoutTokenIsRefused() {
    assertThatThrownBy(() -> connect(null)).isInstanceOf(ExecutionException.class);
  }

  @Test
  void connectWithInvalidTokenIsRefused() {
    assertThatThrownBy(() -> connect("Bearer not-a-jwt")).isInstanceOf(ExecutionException.class);
  }

  private StompSession connect(String authorization) throws Exception {
    StompHeaders connectHeaders = new StompHeaders();
    if (authorization != null) {
      connectHeaders.add(HttpHeaders.AUTHORIZATION, authorization);
    }
    CompletableFuture<StompSession> future =
        stompClient.connectAsync(
            "ws://localhost:" + port + "/ws",
            new WebSocketHttpHeaders(),
            connectHeaders,
            new StompSessionHandlerAdapter() {});
    return future.get(5, TimeUnit.SECONDS);
  }

  /**
   * Subscribes and waits until the broker has registered the subscription, so it exists before the
   * change happens. The simple broker does not answer SUBSCRIBE with a RECEIPT.
   */
  private BlockingQueue<Map<String, Object>> subscribe(StompSession session, String destination)
      throws InterruptedException {
    BlockingQueue<Map<String, Object>> received = new LinkedBlockingQueue<>();
    String subscriptionId =
        session
            .subscribe(
                destination,
                new StompFrameHandler() {
                  @Override
                  public Type getPayloadType(StompHeaders headers) {
                    return Map.class;
                  }

                  @Override
                  @SuppressWarnings("unchecked")
                  public void handleFrame(StompHeaders headers, Object payload) {
                    received.add((Map<String, Object>) payload);
                  }
                })
            .getSubscriptionId();
    SimpMessageHeaderAccessor probe = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
    probe.setDestination(destination);
    Message<byte[]> message = MessageBuilder.createMessage(new byte[0], probe.getMessageHeaders());
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
    while (broker.getSubscriptionRegistry().findSubscriptions(message).values().stream()
        .noneMatch(ids -> ids.contains(subscriptionId))) {
      assertThat(System.nanoTime())
          .as("subscription to %s registered", destination)
          .isLessThan(deadline);
      Thread.sleep(20);
    }
    return received;
  }

  private long createOrder() {
    long addressId =
        jdbc.queryForObject(
            """
            SELECT a.id FROM addresses a JOIN users u ON u.id = a.user_id
            WHERE u.email = ? AND a.is_default = 1 AND a.deleted_at IS NULL
            """,
            Long.class,
            account.email());
    ResponseEntity<Map<String, Object>> created =
        http.exchange(
            "/orders",
            HttpMethod.POST,
            new HttpEntity<>(
                Map.of(
                    "customerName",
                    "Maria Silva",
                    "addressId",
                    addressId,
                    "items",
                    List.of(
                        Map.of(
                            "productId",
                            TestProducts.idOf(jdbc, "pizza-calabresa"),
                            "quantity",
                            1))),
                account.headers()),
            JSON);
    assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    return ((Number) created.getBody().get("id")).longValue();
  }
}
