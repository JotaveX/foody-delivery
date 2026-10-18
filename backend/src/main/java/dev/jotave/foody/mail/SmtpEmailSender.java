package dev.jotave.foody.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

/** Sends over SMTP: Mailpit in dev, so no real credentials are needed. */
class SmtpEmailSender implements EmailSender {

  private final JavaMailSender mailSender;
  private final String from;

  SmtpEmailSender(JavaMailSender mailSender, String from) {
    this.mailSender = mailSender;
    this.from = from;
  }

  @Override
  public void send(EmailMessage message) {
    try {
      MimeMessage mime = mailSender.createMimeMessage();
      boolean multipart = message.html() != null && message.text() != null;
      var helper = new MimeMessageHelper(mime, multipart, StandardCharsets.UTF_8.name());
      helper.setFrom(from);
      helper.setTo(message.to());
      helper.setSubject(message.subject());
      if (multipart) {
        helper.setText(message.text(), message.html());
      } else if (message.html() != null) {
        helper.setText(message.html(), true);
      } else {
        helper.setText(message.text(), false);
      }
      mailSender.send(mime);
    } catch (MessagingException | MailException e) {
      throw new EmailDeliveryException("could not send the e-mail over SMTP", e);
    }
  }
}
