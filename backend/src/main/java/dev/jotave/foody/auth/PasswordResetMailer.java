package dev.jotave.foody.auth;

import dev.jotave.foody.mail.EmailDeliveryException;
import dev.jotave.foody.mail.EmailMessage;
import dev.jotave.foody.mail.EmailSender;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/** Writes and sends the reset e-mail off the request thread (see {@code mail.MailConfig}). */
@Component
public class PasswordResetMailer {

  private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

  private final EmailSender emailSender;

  public PasswordResetMailer(EmailSender emailSender) {
    this.emailSender = emailSender;
  }

  /**
   * @param tokenHash identifies this link: a retry of the same send is not delivered twice
   */
  @Async("mailExecutor")
  public void send(String to, String name, String link, Duration ttl, String tokenHash) {
    String subject = "Redefinição de senha da sua conta Foody";
    long minutes = ttl.toMinutes();
    String text =
        """
        Olá, %s.

        Recebemos um pedido para redefinir a senha da sua conta Foody. Para criar uma nova senha, \
        abra o link abaixo (ele vale por %d minutos e só pode ser usado uma vez):

        %s

        Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.
        """
            .formatted(name, minutes, link);
    String html =
        """
        <p>Olá, %s.</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta Foody.</p>
        <p><a href="%s">Criar uma nova senha</a></p>
        <p>O link vale por %d minutos e só pode ser usado uma vez.</p>
        <p>Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.</p>
        """
            .formatted(HtmlUtils.htmlEscape(name), HtmlUtils.htmlEscape(link), minutes);
    try {
      emailSender.send(new EmailMessage(to, subject, html, text, "password-reset/" + tokenHash));
    } catch (EmailDeliveryException e) {
      // Nobody is waiting on this thread; the user can ask for a new link.
      log.error("Could not send the password reset e-mail", e);
    }
  }
}
