package dev.jotave.foody.realtime;

import dev.jotave.foody.common.CorsProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * STOMP over a plain WebSocket at {@code /ws}, with Spring's in-memory simple broker on {@code
 * /topic}. The broker only reaches clients connected to this instance; cross-instance fan-out goes
 * through Redis pub/sub (see {@code OrderEventsRelay}).
 */
@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

  static final String TOPIC_PREFIX = "/topic";

  private final StompAuthInterceptor stompAuthInterceptor;
  private final StompSessionGuard sessionGuard;
  private final CorsProperties corsProperties;

  WebSocketConfig(
      StompAuthInterceptor stompAuthInterceptor,
      StompSessionGuard sessionGuard,
      CorsProperties corsProperties) {
    this.stompAuthInterceptor = stompAuthInterceptor;
    this.sessionGuard = sessionGuard;
    this.corsProperties = corsProperties;
  }

  /**
   * Same origins as the HTTP API's CORS. The JWT goes in the CONNECT frame, not in a cookie, so
   * this is defense in depth rather than the actual auth.
   */
  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry
        .addEndpoint("/ws")
        .setAllowedOrigins(corsProperties.allowedOrigins().toArray(String[]::new))
        .setAllowedOriginPatterns(corsProperties.allowedOriginPatterns().toArray(String[]::new));
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.enableSimpleBroker(TOPIC_PREFIX);
  }

  @Override
  public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
    registration.addDecoratorFactory(sessionGuard);
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(stompAuthInterceptor);
  }
}
