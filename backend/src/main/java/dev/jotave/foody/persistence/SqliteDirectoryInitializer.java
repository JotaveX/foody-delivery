package dev.jotave.foody.persistence;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;

/**
 * SQLite creates the database file but not its parent directories, so we make sure the directory of
 * the configured file exists before the DataSource is created.
 */
public class SqliteDirectoryInitializer implements EnvironmentPostProcessor {

  private static final String PREFIX = "jdbc:sqlite:";

  @Override
  public void postProcessEnvironment(
      ConfigurableEnvironment environment, SpringApplication application) {
    String url = environment.getProperty("spring.datasource.url");
    if (url == null || !url.startsWith(PREFIX)) {
      return;
    }
    String file = url.substring(PREFIX.length()).split("\\?", 2)[0];
    if (file.isBlank() || file.equals(":memory:") || file.startsWith("file:")) {
      return;
    }
    Path parent = Path.of(file).toAbsolutePath().getParent();
    try {
      Files.createDirectories(parent);
    } catch (IOException e) {
      throw new UncheckedIOException("Could not create SQLite directory " + parent, e);
    }
  }
}
