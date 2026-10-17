package dev.jotave.foody.realtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

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
  private final String[] allowedOrigins;

  WebSocketConfig(
      StompAuthInterceptor stompAuthInterceptor,
      @Value("${app.websocket.allowed-origins:}") String[] allowedOrigins) {
    this.stompAuthInterceptor = stompAuthInterceptor;
    this.allowedOrigins = allowedOrigins;
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws").setAllowedOriginPatterns(allowedOrigins);
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.enableSimpleBroker(TOPIC_PREFIX);
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(stompAuthInterceptor);
  }
}
