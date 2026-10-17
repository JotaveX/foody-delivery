package dev.jotave.foody.observability;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelationIdFilterTest {

  private final CorrelationIdFilter filter = new CorrelationIdFilter();

  @Test
  void reusesValidIncomingIdAndExposesItInMdcAndResponse() throws Exception {
    var request = new MockHttpServletRequest();
    request.addHeader(CorrelationIdFilter.HEADER, "abc-123");
    var response = new MockHttpServletResponse();
    var seenInMdc = new AtomicReference<String>();

    filter.doFilter(request, response, capturingMdc(seenInMdc));

    assertThat(seenInMdc.get()).isEqualTo("abc-123");
    assertThat(response.getHeader(CorrelationIdFilter.HEADER)).isEqualTo("abc-123");
    assertThat(MDC.get(CorrelationIdFilter.MDC_KEY)).isNull();
  }

  @Test
  void generatesIdWhenHeaderIsMissing() throws Exception {
    var response = new MockHttpServletResponse();
    var seenInMdc = new AtomicReference<String>();

    filter.doFilter(new MockHttpServletRequest(), response, capturingMdc(seenInMdc));

    assertThat(seenInMdc.get()).isNotBlank();
    assertThat(response.getHeader(CorrelationIdFilter.HEADER)).isEqualTo(seenInMdc.get());
  }

  @Test
  void replacesUnsafeIncomingId() throws Exception {
    var request = new MockHttpServletRequest();
    request.addHeader(CorrelationIdFilter.HEADER, "bad\nid");
    var response = new MockHttpServletResponse();

    filter.doFilter(request, response, (req, res) -> {});

    assertThat(response.getHeader(CorrelationIdFilter.HEADER))
        .isNotEqualTo("bad\nid")
        .doesNotContain("\n");
  }

  private static FilterChain capturingMdc(AtomicReference<String> target) {
    return (req, res) -> target.set(MDC.get(CorrelationIdFilter.MDC_KEY));
  }
}
