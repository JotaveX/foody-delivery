package dev.jotave.foody.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jotave.foody.observability.CorrelationIdFilter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @AfterEach
  void clearMdc() {
    MDC.clear();
  }

  @Test
  void unexpectedErrorIsAGeneric500WithTheCorrelationId() throws Exception {
    MDC.put(CorrelationIdFilter.MDC_KEY, "abc-123");

    ProblemDetail problem =
        handler.handleUnexpected(new IllegalStateException("db password is hunter2"));

    assertThat(problem.getStatus()).isEqualTo(500);
    assertThat(problem.getDetail()).doesNotContain("hunter2").startsWith("Erro inesperado.");
    assertThat(problem.getProperties())
        .containsEntry("correlationId", "abc-123")
        .doesNotContainKeys("trace", "exception", "message");
  }

  @Test
  void securityExceptionsAreLeftToSpringSecurity() {
    var denied = new AccessDeniedException("nope");

    assertThatThrownBy(() -> handler.handleUnexpected(denied)).isSameAs(denied);
  }
}
