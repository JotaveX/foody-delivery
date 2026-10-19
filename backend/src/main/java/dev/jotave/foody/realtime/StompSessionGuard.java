package dev.jotave.foody.realtime;

import dev.jotave.foody.auth.JwtService.TokenClaims;
import dev.jotave.foody.auth.TokenAuthenticator;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;

/**
 * Closes STOMP sessions whose token expired or was revoked (token_version bump, e.g. a password
 * reset). The token is only checked at CONNECT, so without this a socket opened before the reset
 * would keep receiving every order update for as long as it stays open.
 *
 * <p>Open sockets are tracked in memory: they belong to this instance by nature, unlike the HTTP
 * state that lives in Redis. A sweep every {@code app.realtime.session-check-interval} closes the
 * stale ones; the client then reconnects with its current token, or logs out.
 */
@Component
class StompSessionGuard
    implements WebSocketHandlerDecoratorFactory, InitializingBean, DisposableBean {

  static final CloseStatus TOKEN_NO_LONGER_VALID =
      CloseStatus.POLICY_VIOLATION.withReason("Token expirado ou revogado");

  private static final Logger log = LoggerFactory.getLogger(StompSessionGuard.class);

  private final TokenAuthenticator tokenAuthenticator;
  private final RealtimeProperties properties;
  private final Clock clock;
  private final Map<String, WebSocketSession> sockets = new ConcurrentHashMap<>();
  private final Map<String, TokenClaims> claimsBySession = new ConcurrentHashMap<>();
  private final ScheduledExecutorService sweeper =
      Executors.newSingleThreadScheduledExecutor(
          Thread.ofPlatform().name("stomp-session-guard").daemon().factory());

  StompSessionGuard(TokenAuthenticator tokenAuthenticator, RealtimeProperties properties) {
    this.tokenAuthenticator = tokenAuthenticator;
    this.properties = properties;
    this.clock = Clock.systemUTC();
  }

  /** Called on a successful CONNECT: the session lives only as long as its token. */
  void track(String sessionId, TokenClaims claims) {
    claimsBySession.put(sessionId, claims);
  }

  @Override
  public WebSocketHandler decorate(WebSocketHandler handler) {
    return new WebSocketHandlerDecorator(handler) {
      @Override
      public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sockets.put(session.getId(), session);
        super.afterConnectionEstablished(session);
      }

      @Override
      public void afterConnectionClosed(WebSocketSession session, CloseStatus status)
          throws Exception {
        sockets.remove(session.getId());
        claimsBySession.remove(session.getId());
        super.afterConnectionClosed(session, status);
      }
    };
  }

  @Override
  public void afterPropertiesSet() {
    long interval = properties.sessionCheckInterval().toMillis();
    sweeper.scheduleWithFixedDelay(
        this::closeStaleSessions, interval, interval, TimeUnit.MILLISECONDS);
  }

  @Override
  public void destroy() {
    sweeper.shutdownNow();
  }

  void closeStaleSessions() {
    try {
      Instant now = clock.instant();
      // One token_version lookup per token, however many tabs share it.
      Map<TokenClaims, Boolean> stale = new HashMap<>();
      claimsBySession.forEach(
          (sessionId, claims) -> {
            boolean close =
                stale.computeIfAbsent(
                    claims, c -> !c.expiresAt().isAfter(now) || tokenAuthenticator.isRevoked(c));
            if (close) {
              close(sessionId);
            }
          });
    } catch (RuntimeException e) {
      // A failed sweep (e.g. the database is busy) must not cancel the next ones.
      log.warn("Could not check open STOMP sessions", e);
    }
  }

  private void close(String sessionId) {
    claimsBySession.remove(sessionId);
    WebSocketSession socket = sockets.get(sessionId);
    if (socket == null) {
      return;
    }
    try {
      socket.close(TOKEN_NO_LONGER_VALID);
    } catch (IOException e) {
      log.debug("Could not close STOMP session {}", sessionId, e);
    }
  }
}
