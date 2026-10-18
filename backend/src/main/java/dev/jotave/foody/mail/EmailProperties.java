package dev.jotave.foody.mail;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param from sender, in the {@code Name <address>} form; with Resend its domain must be verified
 */
@ConfigurationProperties("app.mail")
public record EmailProperties(Provider provider, String from, Resend resend) {

  public enum Provider {
    SMTP,
    RESEND
  }

  /**
   * @param timeout applied to both connecting and reading the response
   */
  public record Resend(String apiKey, URI baseUrl, Duration timeout) {}
}
