package dev.jotave.foody.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates requests bearing {@code Authorization: Bearer <jwt>} (see {@link
 * TokenAuthenticator} for what makes a token valid). On failure the request simply proceeds
 * unauthenticated; protected routes are then rejected by the entry point, while public ones still
 * work.
 *
 * <p>Not a {@code @Component}: it is wired into the security chain only, so Spring Boot does not
 * also register it as a plain servlet filter.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  /** Request attribute flagging that a token was sent but rejected (used for the 401 detail). */
  public static final String INVALID_TOKEN_ATTRIBUTE = JwtAuthenticationFilter.class + ".invalid";

  private final TokenAuthenticator tokenAuthenticator;

  public JwtAuthenticationFilter(TokenAuthenticator tokenAuthenticator) {
    this.tokenAuthenticator = tokenAuthenticator;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    TokenAuthenticator.bearerToken(request.getHeader(HttpHeaders.AUTHORIZATION))
        .ifPresent(
            token ->
                tokenAuthenticator
                    .authenticate(token)
                    .ifPresentOrElse(
                        auth -> SecurityContextHolder.getContext().setAuthentication(auth),
                        () -> request.setAttribute(INVALID_TOKEN_ATTRIBUTE, true)));
    chain.doFilter(request, response);
  }
}
