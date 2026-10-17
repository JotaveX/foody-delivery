package dev.jotave.foody;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class FoodyApplicationIT extends IntegrationTest {

  @Autowired private JdbcTemplate jdbc;

  @Test
  void contextLoads() {}

  @Test
  void sqliteConnectionPragmasAreApplied() {
    assertThat(jdbc.queryForObject("PRAGMA journal_mode", String.class))
        .isEqualToIgnoringCase("wal");
    assertThat(jdbc.queryForObject("PRAGMA busy_timeout", Integer.class)).isEqualTo(5000);
    assertThat(jdbc.queryForObject("PRAGMA foreign_keys", Integer.class)).isEqualTo(1);
  }

  @Test
  void flywayAppliedAllMigrations() {
    assertThat(
            jdbc.queryForObject(
                "SELECT version FROM flyway_schema_history WHERE success = 1 ORDER BY installed_rank DESC LIMIT 1",
                String.class))
        .isEqualTo("3");
  }
}
