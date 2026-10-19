package dev.jotave.foody.realtime;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param sessionCheckInterval how often open STOMP sessions are checked for an expired or revoked
 *     token (the upper bound on how long such a session keeps receiving updates)
 */
@ConfigurationProperties("app.realtime")
public record RealtimeProperties(Duration sessionCheckInterval) {}
