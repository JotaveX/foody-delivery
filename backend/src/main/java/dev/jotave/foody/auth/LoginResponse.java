package dev.jotave.foody.auth;

import dev.jotave.foody.user.UserResponse;

/**
 * @param expiresIn token lifetime in seconds
 */
public record LoginResponse(String token, long expiresIn, UserResponse user) {}
