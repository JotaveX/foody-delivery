package dev.jotave.foody.auth;

import dev.jotave.foody.user.UserRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates requests bearing {@code Authorization: Bearer <jwt>}. The token must have a valid
 * signature, must not be expired and its {@code tv} claim must match the user's current
 * token_version. On failure the request simply proceeds unauthenticated; protected routes are then
 * rejected by the entry point, while public ones still work.
 *
 * <p>Not a {@code @Component}: it is wired into the security chain only, so Spring Boot does not
 * also register it as a plain servlet filter.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  /** Request attribute flagging that a token was sent but rejected (used for the 401 detail). */
  public static final String INVALID_TOKEN_ATTRIBUTE = JwtAuthenticationFilter.class + ".invalid";

  private static final String BEARER_PREFIX = "Bearer ";

  private final JwtService jwtService;
  private final UserRepository users;

  public JwtAuthenticationFilter(JwtService jwtService, UserRepository users) {
    this.jwtService = jwtService;
    this.users = users;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String header = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (header != null && header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
      authenticate(header.substring(BEARER_PREFIX.length()).trim(), request);
    }
    chain.doFilter(request, response);
  }

  private void authenticate(String token, HttpServletRequest request) {
    try {
      JwtService.TokenClaims claims = jwtService.parse(token);
      boolean current =
          users
              .findTokenVersionById(claims.userId())
              .map(version -> version == claims.tokenVersion())
              .orElse(false);
      if (!current) {
        request.setAttribute(INVALID_TOKEN_ATTRIBUTE, true);
        return;
      }
      var authentication =
          UsernamePasswordAuthenticationToken.authenticated(
              new AuthenticatedUser(claims.userId()), null, List.of());
      SecurityContextHolder.getContext().setAuthentication(authentication);
    } catch (JwtException | IllegalArgumentException e) {
      request.setAttribute(INVALID_TOKEN_ATTRIBUTE, true);
    }
  }
}
