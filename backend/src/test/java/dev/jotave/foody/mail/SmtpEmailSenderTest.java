package dev.jotave.foody.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class SmtpEmailSenderTest {

  private final JavaMailSender mailSender = mock(JavaMailSender.class);
  private final SmtpEmailSender sender =
      new SmtpEmailSender(mailSender, "Foody <no-reply@foody.local>");

  SmtpEmailSenderTest() {
    when(mailSender.createMimeMessage())
        .thenAnswer(invocation -> new JavaMailSenderImpl().createMimeMessage());
  }

  @Test
  void sendsSenderRecipientAndSubject() throws Exception {
    sender.send(new EmailMessage("maria@example.com", "Olá", "<p>Oi</p>", "Oi"));

    var captor = ArgumentCaptor.forClass(MimeMessage.class);
    verify(mailSender).send(captor.capture());
    MimeMessage sent = captor.getValue();
    assertThat(((InternetAddress) sent.getFrom()[0]).getAddress())
        .isEqualTo("no-reply@foody.local");
    assertThat(sent.getAllRecipients())
        .extracting(Object::toString)
        .containsExactly("maria@example.com");
    assertThat(sent.getSubject()).isEqualTo("Olá");
  }

  @Test
  void smtpFailureBecomesADeliveryException() {
    doThrow(new MailSendException("connection refused"))
        .when(mailSender)
        .send(any(MimeMessage.class));

    assertThatThrownBy(() -> sender.send(new EmailMessage("maria@example.com", "Olá", null, "Oi")))
        .isInstanceOf(EmailDeliveryException.class);
  }
}
