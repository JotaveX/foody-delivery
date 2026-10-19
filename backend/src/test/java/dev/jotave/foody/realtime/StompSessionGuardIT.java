package dev.jotave.foody.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/** The token is only checked at CONNECT; the guard closes sessions that outlive it. */
@TestPropertySource(
    properties = {"app.realtime.session-check-interval=100ms", "app.jwt.expiration=PT5S"})
class StompSessionGuardIT extends IntegrationTest {

  @LocalServerPort private int port;
  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;

  private WebSocketStompClient stompClient;
  private Account account;

  @BeforeEach
  void setUp() {
    stompClient = new WebSocketStompClient(new StandardWebSocketClient());
    stompClient.setMessageConverter(new MappingJackson2MessageConverter());
    account = TestAccounts.createWithoutAddress(http);
  }

  @AfterEach
  void tearDown() {
    stompClient.stop();
  }

  @Test
  void sessionIsClosedOnceTheTokenIsRevoked() throws Exception {
    StompSession session = connect(account);
    StompSession otherUser = connect(TestAccounts.createWithoutAddress(http));

    // What a password reset does: every token issued before it stops being valid.
    jdbc.update(
        "UPDATE users SET token_version = token_version + 1 WHERE email = ?", account.email());

    awaitDisconnected(session, Duration.ofSeconds(2));
    assertThat(otherUser.isConnected()).isTrue();
  }

  @Test
  void sessionIsClosedOnceTheTokenExpires() throws Exception {
    StompSession session = connect(account);

    Thread.sleep(1_000);
    assertThat(session.isConnected()).isTrue();
    awaitDisconnected(session, Duration.ofSeconds(8));
  }

  private StompSession connect(Account who) throws Exception {
    StompHeaders connectHeaders = new StompHeaders();
    connectHeaders.add(HttpHeaders.AUTHORIZATION, "Bearer " + who.token());
    return stompClient
        .connectAsync(
            "ws://localhost:" + port + "/ws",
            new WebSocketHttpHeaders(),
            connectHeaders,
            new StompSessionHandlerAdapter() {})
        .get(5, TimeUnit.SECONDS);
  }

  private static void awaitDisconnected(StompSession session, Duration timeout)
      throws InterruptedException {
    long deadline = System.nanoTime() + timeout.toNanos();
    while (session.isConnected()) {
      assertThat(System.nanoTime()).as("session closed by the server").isLessThan(deadline);
      Thread.sleep(50);
    }
  }
}
