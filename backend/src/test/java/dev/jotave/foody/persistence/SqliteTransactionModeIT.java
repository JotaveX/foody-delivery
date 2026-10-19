package dev.jotave.foody.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jotave.foody.support.IntegrationTest;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatusCode;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.sqlite.SQLiteConfig.TransactionMode;
import org.sqlite.SQLiteConnection;

/**
 * A transaction that reads before it writes cannot upgrade a DEFERRED SQLite transaction once
 * another writer committed (SQLITE_BUSY, without waiting for busy_timeout). Write transactions must
 * start with BEGIN IMMEDIATE, so concurrent writers queue instead of failing.
 */
class SqliteTransactionModeIT extends IntegrationTest {

  private static final int WRITERS = 8;

  @Autowired private TestRestTemplate http;
  @Autowired private DataSource dataSource;
  @Autowired private PlatformTransactionManager transactionManager;

  private TransactionTemplate write;
  private TransactionTemplate readOnly;

  @BeforeEach
  void templates() {
    write = new TransactionTemplate(transactionManager);
    readOnly = new TransactionTemplate(transactionManager);
    readOnly.setReadOnly(true);
  }

  @Test
  void concurrentRegistrationsAllSucceed() throws Exception {
    CountDownLatch start = new CountDownLatch(1);
    try (ExecutorService pool = Executors.newFixedThreadPool(WRITERS)) {
      List<Future<HttpStatusCode>> results =
          IntStream.range(0, WRITERS)
              .mapToObj(
                  i ->
                      pool.submit(
                          () -> {
                            start.await();
                            return register().getStatusCode();
                          }))
              .toList();
      start.countDown();

      for (Future<HttpStatusCode> result : results) {
        assertThat(result.get().value()).isEqualTo(201);
      }
    }
  }

  @Test
  void writeTransactionsBeginImmediateAndReadOnlyOnesStayDeferred() {
    assertThat(modeInside(write)).isEqualTo(TransactionMode.IMMEDIATE);
    assertThat(modeInside(readOnly)).isEqualTo(TransactionMode.DEFERRED);
    // The pooled connection is back to DEFERRED for whoever borrows it next.
    assertThat(modeInside(write)).isEqualTo(TransactionMode.IMMEDIATE);
  }

  private TransactionMode modeInside(TransactionTemplate template) {
    return template.execute(
        status -> {
          try {
            return DataSourceUtils.getConnection(dataSource)
                .unwrap(SQLiteConnection.class)
                .getCurrentTransactionMode();
          } catch (SQLException e) {
            throw new IllegalStateException(e);
          }
        });
  }

  private org.springframework.http.ResponseEntity<Map> register() {
    return http.postForEntity(
        "/auth/register",
        Map.of(
            "name", "Maria Silva",
            "email", "user-" + UUID.randomUUID() + "@example.com",
            "password", "s3nha-segura"),
        Map.class);
  }
}
