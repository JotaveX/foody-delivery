package dev.jotave.foody.auth;

import dev.jotave.foody.user.UserResponse;

/**
 * The refresh token itself is not here: it goes in an HttpOnly cookie.
 *
 * @param expiresIn access token lifetime in seconds
 * @param refreshExpiresIn refresh token lifetime in seconds (renewed on every refresh)
 */
public record LoginResponse(
    String token, long expiresIn, long refreshExpiresIn, UserResponse user) {}
