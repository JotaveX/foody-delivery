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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base class for integration tests: real Redis via Testcontainers and a throwaway SQLite file per
 * test run, migrated by Flyway on context startup.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
public abstract class IntegrationTest {

  @Container
  @ServiceConnection(name = "redis")
  static final GenericContainer<?> REDIS =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

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
