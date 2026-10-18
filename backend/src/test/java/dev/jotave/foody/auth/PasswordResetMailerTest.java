package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.mail.EmailMessage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PasswordResetMailerTest {

  private final List<EmailMessage> sent = new ArrayList<>();
  private final PasswordResetMailer mailer = new PasswordResetMailer(sent::add);

  @Test
  void fillsTheTemplateWithEscapedValues() {
    String html =
        mailer.html("Ana <b>&</b>", "https://foody.jotave.dev/reset-password?token=a&b=1", 30);

    assertThat(html)
        .contains("Ana &lt;b&gt;&amp;&lt;/b&gt;")
        .contains("href=\"https://foody.jotave.dev/reset-password?token=a&amp;b=1\"")
        .contains("30 MIN")
        .contains("O link vale por 30 minutos")
        .doesNotContain("{{");
  }

  @Test
  void sendsHtmlAndPlainTextWithAnIdempotencyKey() {
    mailer.send(
        "ana@example.com",
        "Ana",
        "https://foody.jotave.dev/r?token=x",
        Duration.ofMinutes(30),
        "h1");

    assertThat(sent)
        .singleElement()
        .satisfies(
            email -> {
              assertThat(email.to()).isEqualTo("ana@example.com");
              assertThat(email.html())
                  .contains("Criar nova senha")
                  .contains("https://foody.jotave.dev/r?token=x");
              assertThat(email.text())
                  .contains("https://foody.jotave.dev/r?token=x")
                  .contains("30 minutos");
              assertThat(email.idempotencyKey()).isEqualTo("password-reset/h1");
            });
  }
}
