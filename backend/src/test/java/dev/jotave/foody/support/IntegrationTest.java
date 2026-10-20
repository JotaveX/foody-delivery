package dev.jotave.foody.support;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;

/**
 * Base class for integration tests: real Redis via Testcontainers and a throwaway SQLite file per
 * test run, migrated by Flyway on context startup.
 *
 * <p>Every test registers and logs in from 127.0.0.1, so the rate limits are raised far above what
 * a test run needs; {@code RateLimitIT} overrides them with {@code @TestPropertySource}.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "app.rate-limit.per-ip.login.capacity=100000",
      "app.rate-limit.per-ip.register.capacity=100000",
      "app.rate-limit.per-ip.forgot-password.capacity=100000",
      "app.rate-limit.per-ip.reset-password.capacity=100000",
      "app.rate-limit.per-ip.refresh.capacity=100000",
      "app.rate-limit.per-user.capacity=100000",
      "app.rate-limit.login-failures-per-account.capacity=100000"
    })
public abstract class IntegrationTest {

  // One container for the whole JVM (stopped by Ryuk), not @Container: that would stop it after
  // each test class while Spring keeps cached contexts pointing at its old port.
  @ServiceConnection(name = "redis")
  static final GenericContainer<?> REDIS =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  static {
    REDIS.start();
  }

  private static final Path SQLITE_DIR = createTempDir();

  @DynamicPropertySource
  static void sqliteProperties(DynamicPropertyRegistry registry) {
    registry.add(
        "spring.datasource.url",
        () ->
            "jdbc:sqlite:"
                + SQLITE_DIR.resolve("tracker.db")
                + "?journal_mode=WAL&busy_timeout=5000&foreign_keys=true");
  }

  private static Path createTempDir() {
    try {
      Path dir = Files.createTempDirectory("foody-it-");
      dir.toFile().deleteOnExit();
      return dir;
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
