package dev.jotave.foody.auth;

import dev.jotave.foody.address.AddressResponse;
import dev.jotave.foody.address.AddressService;
import dev.jotave.foody.user.User;
import dev.jotave.foody.user.UserRepository;
import dev.jotave.foody.user.UserResponse;
import java.util.Locale;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final UserRepository users;
  private final AddressService addressService;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final RefreshTokenService refreshTokens;
  private final LoginAttemptLimiter loginAttempts;

  // Compared against when the e-mail is unknown, so both failure paths cost one BCrypt check
  // and response timing does not reveal which e-mails are registered.
  private final String dummyHash;

  public AuthService(
      UserRepository users,
      AddressService addressService,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      RefreshTokenService refreshTokens,
      LoginAttemptLimiter loginAttempts) {
    this.users = users;
    this.addressService = addressService;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.refreshTokens = refreshTokens;
    this.loginAttempts = loginAttempts;
    this.dummyHash = passwordEncoder.encode("dummy-password-for-timing");
  }

  @Transactional
  public UserResponse register(RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (users.existsByEmail(email)) {
      throw new EmailAlreadyRegisteredException();
    }
    User user;
    try {
      user =
          users.saveAndFlush(
              new User(request.name().trim(), email, passwordEncoder.encode(request.password())));
    } catch (DataIntegrityViolationException e) {
      // Lost a race with a concurrent registration of the same e-mail.
      throw new EmailAlreadyRegisteredException();
    }
    // A new user has no address yet.
    return UserResponse.from(user, null);
  }

  @Transactional(readOnly = true)
  public IssuedSession login(LoginRequest request) {
    String email = normalizeEmail(request.email());
    loginAttempts.checkAllowed(email);
    Optional<User> found = users.findByEmail(email);
    String hash = found.map(User::getPasswordHash).orElse(dummyHash);
    boolean matches = passwordEncoder.matches(request.password(), hash);
    if (!matches || found.isEmpty()) {
      loginAttempts.recordFailure(email);
      throw new InvalidCredentialsException();
    }
    User user = found.get();
    return issueSession(user, refreshTokens.issue(user.getId(), user.getTokenVersion()));
  }

  /** Trades a refresh token for a new access token and the next refresh token (rotation). */
  @Transactional(readOnly = true)
  public IssuedSession refresh(String refreshToken) {
    if (refreshToken == null || refreshToken.isBlank()) {
      throw new InvalidRefreshTokenException();
    }
    var owner = refreshTokens.consume(refreshToken).orElseThrow(InvalidRefreshTokenException::new);
    // A password change since the login bumped the version: same rule as for JWTs.
    User user =
        users
            .findById(owner.userId())
            .filter(u -> u.getTokenVersion() == owner.tokenVersion())
            .orElseThrow(InvalidRefreshTokenException::new);
    return issueSession(
        user, refreshTokens.issue(user.getId(), user.getTokenVersion(), owner.family()));
  }

  /** Revokes the refresh token, if any. The access token simply expires. */
  public void logout(String refreshToken) {
    if (refreshToken != null && !refreshToken.isBlank()) {
      refreshTokens.revoke(refreshToken);
    }
  }

  @Transactional(readOnly = true)
  public UserResponse me(long userId) {
    // The JWT filter already checked the user exists; a concurrent delete is the only way here.
    User user = users.findById(userId).orElseThrow(InvalidSessionException::new);
    return toResponse(user);
  }

  private IssuedSession issueSession(User user, String refreshToken) {
    var access = jwtService.issue(user.getId(), user.getTokenVersion());
    var response =
        new LoginResponse(
            access.token(),
            access.expiresInSeconds(),
            refreshTokens.ttl().toSeconds(),
            toResponse(user));
    return new IssuedSession(response, refreshToken);
  }

  private UserResponse toResponse(User user) {
    var defaultAddress = addressService.findDefault(user.getId()).map(AddressResponse::from);
    return UserResponse.from(user, defaultAddress.orElse(null));
  }

  static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  /** The response body plus the refresh token, which the controller puts in a cookie. */
  public record IssuedSession(LoginResponse response, String refreshToken) {}
}
