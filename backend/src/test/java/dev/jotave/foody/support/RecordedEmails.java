package dev.jotave.foody.support;

import dev.jotave.foody.mail.EmailMessage;
import dev.jotave.foody.mail.EmailSender;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Replaces the real {@link EmailSender} in ITs (there is no Mailpit in CI) and keeps every message.
 * E-mails are sent asynchronously, so tests wait for them with {@link #awaitFor}.
 */
@Primary
@Component
public class RecordedEmails implements EmailSender {

  private final List<EmailMessage> sent = new CopyOnWriteArrayList<>();

  @Override
  public void send(EmailMessage message) {
    sent.add(message);
  }

  public List<EmailMessage> to(String recipient) {
    return sent.stream().filter(m -> m.to().equals(recipient)).toList();
  }

  /** Waits up to 5s for the {@code count}-th e-mail to {@code recipient} and returns it. */
  public EmailMessage awaitFor(String recipient, int count) {
    long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
    while (System.nanoTime() < deadline) {
      List<EmailMessage> received = to(recipient);
      if (received.size() >= count) {
        return received.get(count - 1);
      }
      try {
        Thread.sleep(20);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException(e);
      }
    }
    throw new AssertionError("no e-mail #" + count + " to " + recipient);
  }
}
