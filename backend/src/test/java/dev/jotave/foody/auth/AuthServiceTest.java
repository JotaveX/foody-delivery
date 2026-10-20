package dev.jotave.foody.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import dev.jotave.foody.address.AddressService;
import dev.jotave.foody.user.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

  private final UserRepository users = mock(UserRepository.class);
  private final AuthService auth =
      new AuthService(
          users,
          mock(AddressService.class),
          mock(PasswordEncoder.class),
          mock(JwtService.class),
          mock(RefreshTokenService.class),
          mock(LoginAttemptLimiter.class));

  @Test
  void meForAUserDeletedAfterAuthenticationIsAnInvalidSessionNotBadCredentials() {
    when(users.findById(42L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> auth.me(42L))
        .isInstanceOfSatisfying(
            InvalidSessionException.class,
            e -> {
              assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
              assertThat(e.getBody().getDetail())
                  .isEqualTo("Token inválido ou expirado. Faça login novamente.");
            });
  }
}
