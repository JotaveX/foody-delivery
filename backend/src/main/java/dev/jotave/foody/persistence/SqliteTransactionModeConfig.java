package dev.jotave.foody.persistence;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.sqlite.SQLiteConfig.TransactionMode;
import org.sqlite.SQLiteConnection;

/**
 * Starts read-write transactions with {@code BEGIN IMMEDIATE}.
 *
 * <p>A DEFERRED transaction only asks for the write lock at its first write. If another connection
 * committed since this one first read, SQLite cannot upgrade it and fails at once with SQLITE_BUSY,
 * without waiting for busy_timeout: two concurrent sign-ups (check the e-mail, then insert) are
 * enough. IMMEDIATE takes the write lock at BEGIN, where busy_timeout does apply, so writers queue.
 *
 * <p>Read-only transactions stay DEFERRED so they keep reading alongside the writer (WAL). The mode
 * cannot simply go in the JDBC URL: sqlite-jdbc opens the next transaction right inside {@code
 * commit()}, so a global IMMEDIATE would grab the write lock again after every commit, and could
 * even fail there after the data was already committed. The mode is switched back to DEFERRED
 * before every commit and rollback for that reason.
 */
@Configuration(proxyBeanMethods = false)
class SqliteTransactionModeConfig {

  @Bean
  static BeanPostProcessor sqliteTransactionModeDataSource() {
    return new BeanPostProcessor() {
      @Override
      public Object postProcessAfterInitialization(Object bean, String beanName) {
        return bean instanceof DataSource dataSource && !(bean instanceof TransactionModeDataSource)
            ? new TransactionModeDataSource(dataSource)
            : bean;
      }
    };
  }

  static final class TransactionModeDataSource extends DelegatingDataSource {

    TransactionModeDataSource(DataSource target) {
      super(target);
    }

    @Override
    public Connection getConnection() throws SQLException {
      return wrap(super.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
      return wrap(super.getConnection(username, password));
    }

    private static Connection wrap(Connection connection) throws SQLException {
      if (!connection.isWrapperFor(SQLiteConnection.class)) {
        return connection;
      }
      return (Connection)
          Proxy.newProxyInstance(
              Connection.class.getClassLoader(),
              new Class<?>[] {Connection.class},
              new TransactionModeHandler(connection, connection.unwrap(SQLiteConnection.class)));
    }
  }

  private static final class TransactionModeHandler implements InvocationHandler {

    private final Connection target;
    private final SQLiteConnection sqlite;
    // Spring calls setReadOnly(true) before a read-only transaction begins. sqlite-jdbc refuses
    // the flag on an open connection (and Spring ignores that), so it is only tracked here.
    private boolean readOnly;

    TransactionModeHandler(Connection target, SQLiteConnection sqlite) {
      this.target = target;
      this.sqlite = sqlite;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
      switch (method.getName()) {
        case "setReadOnly" -> {
          readOnly = (boolean) args[0];
          return null;
        }
        case "isReadOnly" -> {
          return readOnly;
        }
        case "setAutoCommit" -> {
          boolean beginsTransaction = !(boolean) args[0] && target.getAutoCommit();
          setMode(
              beginsTransaction && !readOnly
                  ? TransactionMode.IMMEDIATE
                  : TransactionMode.DEFERRED);
        }
        case "commit", "rollback" -> setMode(TransactionMode.DEFERRED);
        default -> {}
      }
      try {
        return method.invoke(target, args);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }

    private void setMode(TransactionMode mode) {
      sqlite.getConnectionConfig().setTransactionMode(mode);
    }
  }
}
