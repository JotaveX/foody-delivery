package dev.jotave.foody.idempotency;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.idempotency")
public record IdempotencyProperties(Duration ttl) {}
