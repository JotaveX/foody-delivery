package dev.jotave.foody.auth;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param url SPA page that receives the token as {@code ?token=}
 * @param ttl how long a reset link stays valid
 * @param cooldown minimum interval between two reset e-mails to the same user
 */
@ConfigurationProperties("app.password-reset")
public record PasswordResetProperties(URI url, Duration ttl, Duration cooldown) {}
