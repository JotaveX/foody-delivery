package dev.jotave.foody.auth;

import dev.jotave.foody.mail.EmailDeliveryException;
import dev.jotave.foody.mail.EmailMessage;
import dev.jotave.foody.mail.EmailSender;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;

/**
 * Writes and sends the reset e-mail. Called on {@code mailExecutor} by {@link
 * PasswordResetService}, never on the request thread.
 */
@Component
public class PasswordResetMailer {

  private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

  /** Kitchen-ticket layout (see DESIGN.md), with {{name}}, {{link}} and {{minutes}} slots. */
  private static final String TEMPLATE = "mail/password-reset.html";

  private final EmailSender emailSender;
  private final String template;

  public PasswordResetMailer(EmailSender emailSender) {
    this.emailSender = emailSender;
    try (var in = new ClassPathResource(TEMPLATE).getInputStream()) {
      this.template = StreamUtils.copyToString(in, StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new UncheckedIOException("Missing e-mail template " + TEMPLATE, e);
    }
  }

  /**
   * @param tokenHash identifies this link: a retry of the same send is not delivered twice
   */
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
    String html = html(name, link, minutes);
    try {
      emailSender.send(new EmailMessage(to, subject, html, text, "password-reset/" + tokenHash));
    } catch (EmailDeliveryException e) {
      // Nobody is waiting on this thread; the user can ask for a new link.
      log.error("Could not send the password reset e-mail", e);
    }
  }

  /** The HTML body; every value is escaped, so a name like {@code <b>} shows up as typed. */
  String html(String name, String link, long minutes) {
    return template
        .replace("{{name}}", HtmlUtils.htmlEscape(name))
        .replace("{{link}}", HtmlUtils.htmlEscape(link))
        .replace("{{minutes}}", String.valueOf(minutes));
  }
}
