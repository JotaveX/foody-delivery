package dev.jotave.foody.common;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class Timestamps {

  private Timestamps() {}

  /**
   * Current instant truncated to milliseconds, the precision SQLite stores. Keeps a freshly created
   * entity identical to the same row read back from the database.
   */
  public static Instant now() {
    return Instant.now().truncatedTo(ChronoUnit.MILLIS);
  }
}
