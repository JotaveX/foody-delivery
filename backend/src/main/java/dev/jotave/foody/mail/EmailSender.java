package dev.jotave.foody.mail;

/**
 * Sends transactional e-mail. The implementation is picked by {@code app.mail.provider}: Resend in
 * production, SMTP (Mailpit) in dev.
 */
public interface EmailSender {

  /**
   * Sends synchronously.
   *
   * @throws EmailDeliveryException if the provider rejects the message or cannot be reached
   */
  void send(EmailMessage message);
}
