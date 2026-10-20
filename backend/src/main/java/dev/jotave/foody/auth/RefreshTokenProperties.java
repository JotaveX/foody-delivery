package dev.jotave.foody.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param ttl how long a refresh token stays valid; each refresh issues a new one with a full ttl
 * @param cookieSecure the cookie's {@code Secure} flag; off only for plain-HTTP dev
 */
@ConfigurationProperties("app.refresh-token")
public record RefreshTokenProperties(Duration ttl, boolean cookieSecure) {}
