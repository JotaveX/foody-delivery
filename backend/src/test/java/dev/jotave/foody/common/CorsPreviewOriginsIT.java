package dev.jotave.foody.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jotave.foody.support.IntegrationTest;
import java.net.URI;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** The production pattern for Cloudflare Pages previews, on both the HTTP API and {@code /ws}. */
@TestPropertySource(properties = "app.cors.allowed-origin-patterns=https://*.foody.pages.dev")
class CorsPreviewOriginsIT extends IntegrationTest {

  private static final String PREVIEW_ORIGIN = "https://feat-login.foody.pages.dev";
  // Ends with the right suffix only if the pattern were not anchored.
  private static final String LOOKALIKE_ORIGIN = "https://feat-login.foody.pages.dev.evil.example";

  @LocalServerPort private int port;
  @Autowired private TestRestTemplate http;

  @Test
  void previewOriginPassesThePreflight() {
    ResponseEntity<String> response = preflight(PREVIEW_ORIGIN);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getHeaders().getAccessControlAllowOrigin()).isEqualTo(PREVIEW_ORIGIN);
  }

  @Test
  void lookalikeOriginIsRejected() {
    assertThat(preflight(LOOKALIKE_ORIGIN).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(preflight("https://foody.pages.dev.evil.example").getStatusCode())
        .isEqualTo(HttpStatus.FORBIDDEN);
  }

  @Test
  void exactOriginStillWorksAlongsideThePattern() {
    ResponseEntity<String> response = preflight("http://localhost:5173");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void webSocketHandshakeAcceptsThePreviewOrigin() throws Exception {
    WebSocketSession session = handshake(PREVIEW_ORIGIN);

    assertThat(session.isOpen()).isTrue();
    session.close();
  }

  @Test
  void webSocketHandshakeRejectsOtherOrigins() {
    assertThatThrownBy(() -> handshake(LOOKALIKE_ORIGIN)).isInstanceOf(ExecutionException.class);
  }

  private ResponseEntity<String> preflight(String origin) {
    var headers = new HttpHeaders();
    headers.setOrigin(origin);
    headers.set(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET");
    headers.set(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization");
    return http.exchange("/orders", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
  }

  private WebSocketSession handshake(String origin) throws Exception {
    var headers = new WebSocketHttpHeaders();
    headers.setOrigin(origin);
    return new StandardWebSocketClient()
        .execute(new TextWebSocketHandler(), headers, URI.create("ws://localhost:" + port + "/ws"))
        .get(5, TimeUnit.SECONDS);
  }
}
