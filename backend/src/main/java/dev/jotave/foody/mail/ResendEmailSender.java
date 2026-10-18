package dev.jotave.foody.mail;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Sends through Resend's HTTP API ({@code POST /emails}). The plain REST call keeps the official
 * SDK and its HTTP client out of a JVM capped at 350 MB.
 */
class ResendEmailSender implements EmailSender {

  private static final Logger log = LoggerFactory.getLogger(ResendEmailSender.class);

  // Resend error bodies are short JSON; anything longer is cut to keep the logs readable.
  private static final int MAX_ERROR_BODY = 500;

  private final RestClient client;
  private final String from;

  /**
   * @param builder the request factory (timeouts) is expected to be set already; base URL and
   *     credentials are added here
   */
  ResendEmailSender(RestClient.Builder builder, EmailProperties.Resend resend, String from) {
    if (resend.apiKey() == null || resend.apiKey().isBlank()) {
      throw new IllegalStateException("app.mail.resend.api-key (RESEND_API_KEY) is required");
    }
    if (from == null || from.isBlank()) {
      throw new IllegalStateException("app.mail.from (MAIL_FROM) is required");
    }
    this.client =
        builder
            .baseUrl(resend.baseUrl().toString())
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + resend.apiKey())
            .build();
    this.from = from;
  }

  @Override
  public void send(EmailMessage message) {
    var body =
        new SendRequest(
            from, List.of(message.to()), message.subject(), message.html(), message.text());
    SendResponse response;
    try {
      response =
          client
              .post()
              .uri("/emails")
              .contentType(MediaType.APPLICATION_JSON)
              .headers(
                  headers -> {
                    if (message.idempotencyKey() != null) {
                      headers.set("Idempotency-Key", message.idempotencyKey());
                    }
                  })
              .body(body)
              .retrieve()
              .onStatus(
                  HttpStatusCode::isError,
                  (request, res) -> {
                    String error = StreamUtils.copyToString(res.getBody(), StandardCharsets.UTF_8);
                    if (error.length() > MAX_ERROR_BODY) {
                      error = error.substring(0, MAX_ERROR_BODY);
                    }
                    throw new EmailDeliveryException(
                        "Resend rejected the e-mail with " + res.getStatusCode() + ": " + error);
                  })
              .body(SendResponse.class);
    } catch (EmailDeliveryException e) {
      throw e;
    } catch (RestClientException e) {
      throw new EmailDeliveryException("could not reach Resend", e);
    }
    log.info("e-mail sent via Resend (id {})", response == null ? null : response.id());
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record SendRequest(String from, List<String> to, String subject, String html, String text) {}

  record SendResponse(String id) {}
}
