package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import dev.jotave.foody.user.UserRepository;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordResetServiceTest {

  private static final PasswordResetProperties PROPERTIES =
      new PasswordResetProperties(
          URI.create("https://foody.jotave.dev/reset-password"),
          Duration.ofMinutes(30),
          Duration.ofMinutes(1));

  private final UserRepository users = mock(UserRepository.class);
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
  private final List<Runnable> queued = new ArrayList<>();

  @Test
  void theRequestThreadOnlyQueuesTheWork() {
    when(users.findByEmail(anyString())).thenReturn(Optional.empty());
    PasswordResetService service = service(queued::add);

    service.requestReset("Maria@Example.com");

    // The account lookup is not on the request thread, so its timing cannot leak.
    verifyNoInteractions(users, redis);
    queued.forEach(Runnable::run);
    verify(users).findByEmail("maria@example.com");
  }

  @Test
  void aFullQueueAnswersLikeAnyOtherRequest() {
    PasswordResetService service =
        service(
            task -> {
              throw new TaskRejectedException("full");
            });

    assertThatCode(() -> service.requestReset("maria@example.com")).doesNotThrowAnyException();
  }

  private PasswordResetService service(TaskExecutor executor) {
    return new PasswordResetService(
        users,
        redis,
        mock(PasswordEncoder.class),
        mock(PasswordResetMailer.class),
        PROPERTIES,
        executor);
  }
}
