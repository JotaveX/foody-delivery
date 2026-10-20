package dev.jotave.foody.auth;

import dev.jotave.foody.user.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

  private final AuthService authService;
  private final PasswordResetService passwordResetService;
  private final RefreshTokenCookie refreshCookie;

  public AuthController(
      AuthService authService,
      PasswordResetService passwordResetService,
      RefreshTokenCookie refreshCookie) {
    this.authService = authService;
    this.passwordResetService = passwordResetService;
    this.refreshCookie = refreshCookie;
  }

  @Operation(summary = "Register a user together with their default delivery address")
  @PostMapping("/register")
  public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
    UserResponse user = authService.register(request);
    return ResponseEntity.created(URI.create("/auth/me")).body(user);
  }

  @Operation(
      summary = "Exchange e-mail and password for a JWT",
      description = "Also sets the refresh token as an HttpOnly cookie.")
  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    return withRefreshCookie(authService.login(request));
  }

  @Operation(
      summary = "Exchange the refresh token cookie for a new JWT",
      description = "The refresh token is single-use: the response sets the next one.")
  @PostMapping("/refresh")
  public ResponseEntity<LoginResponse> refresh(
      @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
    return withRefreshCookie(authService.refresh(refreshToken));
  }

  @Operation(summary = "Revoke the refresh token and clear its cookie", description = "Always 204.")
  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken) {
    authService.logout(refreshToken);
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, refreshCookie.clear().toString())
        .build();
  }

  @Operation(
      summary = "E-mail a password reset link",
      description = "Always 204, whether or not the e-mail is registered.")
  @PostMapping("/forgot-password")
  public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
    passwordResetService.requestReset(request.email());
    return ResponseEntity.noContent().build();
  }

  @Operation(summary = "Set a new password with the token from the reset e-mail")
  @PostMapping("/reset-password")
  public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
    passwordResetService.reset(request.token(), request.password());
    return ResponseEntity.noContent().build();
  }

  @Operation(
      summary = "Current user with their default address",
      security = @SecurityRequirement(name = "bearer"))
  @GetMapping("/me")
  public UserResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
    return authService.me(principal.id());
  }

  /** A dead refresh token also drops its cookie, so the browser stops sending it. */
  @ExceptionHandler(InvalidRefreshTokenException.class)
  ResponseEntity<ProblemDetail> invalidRefreshToken(InvalidRefreshTokenException e) {
    return ResponseEntity.status(e.getStatusCode())
        .header(HttpHeaders.SET_COOKIE, refreshCookie.clear().toString())
        .body(e.getBody());
  }

  private ResponseEntity<LoginResponse> withRefreshCookie(AuthService.IssuedSession session) {
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, refreshCookie.issue(session.refreshToken()).toString())
        .body(session.response());
  }
}
