package dev.jotave.foody.auth;

import dev.jotave.foody.user.UserRepository;
import io.jsonwebtoken.JwtException;
import java.util.List;
import java.util.Optional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Turns a bearer token into an {@link Authentication}. The token must have a valid signature, must
 * not be expired and its {@code tv} claim must match the user's current token_version. Shared by
 * the HTTP filter and the STOMP CONNECT interceptor, so both channels accept exactly the same
 * tokens.
 */
@Component
public class TokenAuthenticator {

  private static final String BEARER_PREFIX = "Bearer ";

  private final JwtService jwtService;
  private final UserRepository users;

  public TokenAuthenticator(JwtService jwtService, UserRepository users) {
    this.jwtService = jwtService;
    this.users = users;
  }

  /**
   * @param header the raw {@code Authorization} header value
   * @return empty if the header is not a bearer token
   */
  public static Optional<String> bearerToken(String header) {
    if (header != null && header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
      return Optional.of(header.substring(BEARER_PREFIX.length()).trim());
    }
    return Optional.empty();
  }

  /** Empty if the token is invalid, expired or was revoked by a token_version bump. */
  public Optional<Authentication> authenticate(String token) {
    return verify(token)
        .<Authentication>map(
            claims ->
                UsernamePasswordAuthenticationToken.authenticated(
                    new AuthenticatedUser(claims.userId()), null, List.of()));
  }

  /** The claims of a token that is validly signed, not expired and not revoked. */
  public Optional<JwtService.TokenClaims> verify(String token) {
    try {
      JwtService.TokenClaims claims = jwtService.parse(token);
      return isRevoked(claims) ? Optional.empty() : Optional.of(claims);
    } catch (JwtException | IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  /** True once the user's token_version moved past the token's (or the user is gone). */
  public boolean isRevoked(JwtService.TokenClaims claims) {
    return users
        .findTokenVersionById(claims.userId())
        .map(version -> version != claims.tokenVersion())
        .orElse(true);
  }
}
