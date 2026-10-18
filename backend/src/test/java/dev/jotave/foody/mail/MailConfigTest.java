package dev.jotave.foody.mail;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

class MailConfigTest {

  @Configuration(proxyBeanMethods = false)
  @EnableConfigurationProperties(EmailProperties.class)
  static class Properties {}

  private final ApplicationContextRunner runner =
      new ApplicationContextRunner()
          .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
          .withUserConfiguration(Properties.class, MailConfig.class)
          .withBean(RestClient.Builder.class, RestClient::builder)
          .withPropertyValues(
              "app.mail.from=Foody <no-reply@foody.local>",
              "app.mail.resend.base-url=https://api.resend.com",
              "app.mail.resend.timeout=10s");

  @Test
  void resendProviderUsesResend() {
    runner
        .withPropertyValues("app.mail.provider=resend", "app.mail.resend.api-key=re_test_key")
        .run(
            context ->
                assertThat(context)
                    .getBean(EmailSender.class)
                    .isInstanceOf(ResendEmailSender.class));
  }

  @Test
  void resendProviderWithoutApiKeyFailsToStart() {
    runner
        .withPropertyValues("app.mail.provider=resend")
        .run(context -> assertThat(context).hasFailed());
  }

  @Test
  void smtpProviderUsesSmtp() {
    runner
        .withPropertyValues("app.mail.provider=smtp", "spring.mail.host=localhost")
        .run(
            context ->
                assertThat(context).getBean(EmailSender.class).isInstanceOf(SmtpEmailSender.class));
  }

  @Test
  void smtpProviderWithoutHostFailsToStart() {
    runner
        .withPropertyValues("app.mail.provider=smtp")
        .run(context -> assertThat(context).hasFailed());
  }
}
