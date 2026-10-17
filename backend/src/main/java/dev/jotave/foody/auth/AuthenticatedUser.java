package dev.jotave.foody.auth;

/** Principal stored in the SecurityContext for requests carrying a valid JWT. */
public record AuthenticatedUser(long id) {}
