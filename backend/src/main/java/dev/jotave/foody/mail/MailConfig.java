package dev.jotave.foody.mail;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestClient;

/**
 * Exactly one {@link EmailSender}, chosen by {@code app.mail.provider}, plus {@code mailExecutor}
 * for sends that must not hold the request.
 */
@Configuration(proxyBeanMethods = false)
class MailConfig {

  @Bean
  @ConditionalOnProperty(name = "app.mail.provider", havingValue = "resend")
  EmailSender resendEmailSender(RestClient.Builder restClientBuilder, EmailProperties properties) {
    var requestFactory = new SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(properties.resend().timeout());
    requestFactory.setReadTimeout(properties.resend().timeout());
    // Boot's builder is a prototype bean, so changing it does not affect other clients.
    return new ResendEmailSender(
        restClientBuilder.requestFactory(requestFactory), properties.resend(), properties.from());
  }

  @Bean
  @ConditionalOnProperty(name = "app.mail.provider", havingValue = "smtp")
  EmailSender smtpEmailSender(
      ObjectProvider<JavaMailSender> mailSender, EmailProperties properties) {
    JavaMailSender sender = mailSender.getIfAvailable();
    if (sender == null) {
      // Boot only creates the JavaMailSender when spring.mail.host is set.
      throw new IllegalStateException("app.mail.provider=smtp requires SMTP_HOST");
    }
    return new SmtpEmailSender(sender, properties.from());
  }

  /**
   * Small and bounded: e-mail is rare here, and a burst beyond the queue is rejected instead of
   * piling up in a 350 MB heap. Pending sends are lost on shutdown; the user can ask again.
   */
  @Bean
  ThreadPoolTaskExecutor mailExecutor() {
    var executor = new ThreadPoolTaskExecutor();
    executor.setThreadNamePrefix("mail-");
    executor.setCorePoolSize(1);
    executor.setMaxPoolSize(2);
    executor.setQueueCapacity(100);
    return executor;
  }
}
