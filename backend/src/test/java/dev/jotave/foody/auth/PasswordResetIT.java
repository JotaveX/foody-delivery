package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.mail.EmailMessage;
import dev.jotave.foody.support.IntegrationTest;
import dev.jotave.foody.support.RecordedEmails;
import dev.jotave.foody.support.TestAccounts;
import dev.jotave.foody.support.TestAccounts.Account;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class PasswordResetIT extends IntegrationTest {

  private static final String NEW_PASSWORD = "nova-s3nha-segura";
  private static final Pattern LINK =
      Pattern.compile("http://localhost:5173/reset-password\\?token=([A-Za-z0-9_-]+)");

  @Autowired private TestRestTemplate http;
  @Autowired private RecordedEmails emails;
  @Autowired private StringRedisTemplate redis;

  @Test
  void resetLinkChangesThePasswordAndRevokesExistingSessions() {
    Account account = TestAccounts.createWithoutAddress(http);

    assertThat(forgot(account.email()).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    EmailMessage email = emails.awaitFor(account.email(), 1);
    assertThat(email.subject()).contains("Redefinição de senha");
    assertThat(email.html()).contains("Maria Silva");
    String token = tokenFrom(email);

    assertThat(reset(token, NEW_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

    assertThat(me(account).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(login(account.email(), TestAccounts.PASSWORD).getStatusCode())
        .isEqualTo(HttpStatus.UNAUTHORIZED);
    assertThat(login(account.email(), NEW_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.OK);
  }

  @Test
  void tokenWorksOnlyOnce() {
    Account account = TestAccounts.createWithoutAddress(http);
    forgot(account.email());
    String token = tokenFrom(emails.awaitFor(account.email(), 1));
    reset(token, NEW_PASSWORD);

    ResponseEntity<Map> again = reset(token, "outra-s3nha-segura");

    assertThat(again.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(again.getBody())
        .containsEntry("detail", "Link de redefinição inválido ou expirado. Solicite um novo.");
  }

  @Test
  void resettingThePasswordInvalidatesOtherPendingLinks() {
    Account account = TestAccounts.createWithoutAddress(http);
    forgot(account.email());
    String first = tokenFrom(emails.awaitFor(account.email(), 1));
    redis.delete("pwreset-cooldown:" + userId(account));
    forgot(account.email());
    String second = tokenFrom(emails.awaitFor(account.email(), 2));

    assertThat(reset(second, NEW_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

    assertThat(reset(first, "outra-s3nha-segura").getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void unknownEmailGetsTheSameAnswerAndNoEmail() throws InterruptedException {
    String unknown = "nobody-" + UUID.randomUUID() + "@example.com";

    assertThat(forgot(unknown).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

    Thread.sleep(200);
    assertThat(emails.to(unknown)).isEmpty();
  }

  @Test
  void secondRequestWithinTheCooldownSendsNothing() throws InterruptedException {
    Account account = TestAccounts.createWithoutAddress(http);
    forgot(account.email());
    emails.awaitFor(account.email(), 1);

    assertThat(forgot(account.email().toUpperCase()).getStatusCode())
        .isEqualTo(HttpStatus.NO_CONTENT);

    Thread.sleep(200);
    assertThat(emails.to(account.email())).hasSize(1);
  }

  @Test
  void unknownTokenIsRejected() {
    assertThat(reset("not-a-real-token", NEW_PASSWORD).getStatusCode())
        .isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void shortPasswordIsRejectedWithoutConsumingTheToken() {
    Account account = TestAccounts.createWithoutAddress(http);
    forgot(account.email());
    String token = tokenFrom(emails.awaitFor(account.email(), 1));

    ResponseEntity<Map> response = reset(token, "curta");

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(reset(token, NEW_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
  }

  private ResponseEntity<Void> forgot(String email) {
    return http.postForEntity("/auth/forgot-password", Map.of("email", email), Void.class);
  }

  private ResponseEntity<Map> reset(String token, String password) {
    return http.postForEntity(
        "/auth/reset-password", Map.of("token", token, "password", password), Map.class);
  }

  private ResponseEntity<Map> login(String email, String password) {
    return http.postForEntity(
        "/auth/login", Map.of("email", email, "password", password), Map.class);
  }

  private ResponseEntity<Map> me(Account account) {
    return http.exchange(
        "/auth/me", HttpMethod.GET, new HttpEntity<>(account.headers()), Map.class);
  }

  private long userId(Account account) {
    return ((Number) me(account).getBody().get("id")).longValue();
  }

  private static String tokenFrom(EmailMessage email) {
    Matcher matcher = LINK.matcher(email.text());
    assertThat(matcher.find()).as("reset link in %s", email.text()).isTrue();
    return matcher.group(1);
  }
}
