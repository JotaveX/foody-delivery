package dev.jotave.foody.mail;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ResendEmailSenderTest {

  private static final String FROM = "Foody <no-reply@foody.jotave.dev>";
  private static final EmailProperties.Resend RESEND =
      new EmailProperties.Resend(
          "re_test_key", URI.create("https://api.resend.test"), Duration.ofSeconds(5));

  private final RestClient.Builder builder = RestClient.builder();
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final ResendEmailSender sender = new ResendEmailSender(builder, RESEND, FROM);

  @Test
  void postsTheMessageWithTheApiKey() {
    server
        .expect(requestTo("https://api.resend.test/emails"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header("Authorization", "Bearer re_test_key"))
        .andExpect(headerDoesNotExist("Idempotency-Key"))
        .andExpect(
            content()
                .json(
                    """
                    {"from": "Foody <no-reply@foody.jotave.dev>", "to": ["maria@example.com"],
                     "subject": "Olá", "html": "<p>Oi</p>", "text": "Oi"}
                    """,
                    true))
        .andRespond(withSuccess("{\"id\":\"abc\"}", MediaType.APPLICATION_JSON));

    sender.send(new EmailMessage("maria@example.com", "Olá", "<p>Oi</p>", "Oi"));

    server.verify();
  }

  @Test
  void omitsMissingBodiesAndForwardsTheIdempotencyKey() {
    server
        .expect(requestTo("https://api.resend.test/emails"))
        .andExpect(header("Idempotency-Key", "password-reset/42"))
        .andExpect(
            content()
                .json(
                    """
                    {"from": "Foody <no-reply@foody.jotave.dev>", "to": ["maria@example.com"],
                     "subject": "Olá", "text": "Oi"}
                    """,
                    true))
        .andRespond(withSuccess("{\"id\":\"abc\"}", MediaType.APPLICATION_JSON));

    sender.send(new EmailMessage("maria@example.com", "Olá", null, "Oi", "password-reset/42"));

    server.verify();
  }

  @Test
  void rejectionBecomesADeliveryExceptionWithResendsMessage() {
    server
        .expect(requestTo("https://api.resend.test/emails"))
        .andRespond(
            withStatus(HttpStatus.FORBIDDEN)
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    """
                    {"statusCode":403,"name":"validation_error","message":"domain not verified"}
                    """));

    assertThatThrownBy(() -> sender.send(new EmailMessage("maria@example.com", "Olá", null, "Oi")))
        .isInstanceOf(EmailDeliveryException.class)
        .hasMessageContaining("403")
        .hasMessageContaining("domain not verified");
  }

  @Test
  void networkFailureBecomesADeliveryException() {
    server
        .expect(requestTo("https://api.resend.test/emails"))
        .andRespond(
            request -> {
              throw new IOException("connection reset");
            });

    assertThatThrownBy(() -> sender.send(new EmailMessage("maria@example.com", "Olá", null, "Oi")))
        .isInstanceOf(EmailDeliveryException.class)
        .hasMessage("could not reach Resend");
  }

  @Test
  void missingApiKeyFailsAtStartup() {
    var noKey = new EmailProperties.Resend(" ", RESEND.baseUrl(), RESEND.timeout());

    assertThatThrownBy(() -> new ResendEmailSender(RestClient.builder(), noKey, FROM))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RESEND_API_KEY");
  }
}
