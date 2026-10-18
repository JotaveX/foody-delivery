package dev.jotave.foody.mail;

import java.util.Objects;

/**
 * A single transactional e-mail. At least one of {@code html} and {@code text} must be present.
 *
 * @param idempotencyKey optional; a retry with the same key is not delivered twice by providers
 *     that support it (Resend keeps it for 24h), e.g. {@code password-reset/42}
 */
public record EmailMessage(
    String to, String subject, String html, String text, String idempotencyKey) {

  public EmailMessage {
    Objects.requireNonNull(to, "to");
    Objects.requireNonNull(subject, "subject");
    if (html == null && text == null) {
      throw new IllegalArgumentException("an e-mail needs an html or a text body");
    }
  }

  public EmailMessage(String to, String subject, String html, String text) {
    this(to, subject, html, text, null);
  }
}
