package dev.jotave.foody.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.jotave.foody.auth.AuthenticatedUser;
import dev.jotave.foody.ratelimit.RateLimitProperties.Limit;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

/**
 * Applies the per-IP limits of public paths (login, register…) and the per-user limit of the
 * authenticated API. Runs in the security chain right after JWT authentication, so the user is
 * already known. Allowed responses carry {@code X-RateLimit-Remaining} (the tightest bucket);
 * rejected ones are a 429 ProblemDetail with {@code Retry-After} in seconds.
 *
 * <p>If Redis is unavailable the request is let through (fail open): losing rate limiting briefly
 * is better than taking the whole API down with it.
 *
 * <p>Not a {@code @Component}, for the same reason as the JWT filter.
 */
public class RateLimitFilter extends OncePerRequestFilter {

  public static final String REMAINING_HEADER = "X-RateLimit-Remaining";

  private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

  private final RateLimiter rateLimiter;
  private final ClientIpResolver clientIpResolver;
  private final RateLimitProperties properties;
  private final ObjectMapper objectMapper;

  public RateLimitFilter(
      RateLimiter rateLimiter,
      ClientIpResolver clientIpResolver,
      RateLimitProperties properties,
      ObjectMapper objectMapper) {
    this.rateLimiter = rateLimiter;
    this.clientIpResolver = clientIpResolver;
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  private record Quota(String name, String subject, Limit limit) {}

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    List<Quota> quotas = properties.enabled() ? quotasFor(request) : List.of();
    long remaining = Long.MAX_VALUE;
    try {
      for (Quota quota : quotas) {
        ConsumptionProbe probe =
            rateLimiter.tryConsume(quota.name(), quota.subject(), quota.limit());
        if (!probe.isConsumed()) {
          reject(request, response, probe);
          return;
        }
        remaining = Math.min(remaining, probe.getRemainingTokens());
      }
      if (!quotas.isEmpty()) {
        response.setHeader(REMAINING_HEADER, String.valueOf(remaining));
      }
    } catch (RuntimeException e) {
      log.warn("Rate limiting skipped: bucket store unavailable", e);
    }
    chain.doFilter(request, response);
  }

  private List<Quota> quotasFor(HttpServletRequest request) {
    List<Quota> quotas = new ArrayList<>();
    String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
    properties.perIp().entrySet().stream()
        .filter(e -> e.getValue().path().equals(path))
        .forEach(
            e ->
                quotas.add(
                    new Quota(
                        e.getKey(), clientIpResolver.resolve(request), e.getValue().limit())));
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (properties.perUser() != null
        && auth != null
        && auth.getPrincipal() instanceof AuthenticatedUser user) {
      quotas.add(new Quota("user", String.valueOf(user.id()), properties.perUser()));
    }
    return quotas;
  }

  private void reject(
      HttpServletRequest request, HttpServletResponse response, ConsumptionProbe probe)
      throws IOException {
    long retryAfter = Math.max(1, ceilSeconds(probe.getNanosToWaitForRefill()));
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.TOO_MANY_REQUESTS,
            "Muitas requisições. Tente novamente em %d segundo%s."
                .formatted(retryAfter, retryAfter == 1 ? "" : "s"));
    problem.setInstance(URI.create(request.getRequestURI()));
    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
    response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfter));
    response.setHeader(REMAINING_HEADER, "0");
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    response.setCharacterEncoding("UTF-8");
    objectMapper.writeValue(response.getOutputStream(), problem);
  }

  private static long ceilSeconds(long nanos) {
    return (nanos + TimeUnit.SECONDS.toNanos(1) - 1) / TimeUnit.SECONDS.toNanos(1);
  }
}
