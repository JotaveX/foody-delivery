package dev.jotave.foody.realtime;

import dev.jotave.foody.auth.TokenAuthenticator;
import java.security.Principal;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Authenticates STOMP sessions. The JWT travels in the {@code Authorization} header of the CONNECT
 * frame rather than in the handshake URL, where it would end up in proxy and access logs. A CONNECT
 * without a valid token is refused (the client gets an ERROR frame and the socket is closed).
 *
 * <p>Clients may only SUBSCRIBE to {@code /topic/**}; SEND is refused so nobody can publish forged
 * updates straight into the broker.
 */
@Component
class StompAuthInterceptor implements ChannelInterceptor {

  private final TokenAuthenticator tokenAuthenticator;

  StompAuthInterceptor(TokenAuthenticator tokenAuthenticator) {
    this.tokenAuthenticator = tokenAuthenticator;
  }

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor =
        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    if (accessor == null || accessor.getCommand() == null) {
      return message;
    }
    switch (accessor.getCommand()) {
      case CONNECT, STOMP -> accessor.setUser(authenticate(accessor));
      case SUBSCRIBE -> requireSubscriptionAllowed(accessor);
      case SEND -> throw new MessageDeliveryException("Envio de mensagens não é permitido");
      default -> {}
    }
    return message;
  }

  private Principal authenticate(StompHeaderAccessor accessor) {
    return TokenAuthenticator.bearerToken(accessor.getFirstNativeHeader(HttpHeaders.AUTHORIZATION))
        .flatMap(tokenAuthenticator::authenticate)
        .orElseThrow(() -> new MessageDeliveryException("Token ausente, inválido ou expirado"));
  }

  private static void requireSubscriptionAllowed(StompHeaderAccessor accessor) {
    // CONNECT already refused anonymous sessions; this guards against frames sent before it.
    if (accessor.getUser() == null) {
      throw new MessageDeliveryException("Autenticação necessária");
    }
    String destination = accessor.getDestination();
    if (destination == null || !destination.startsWith(WebSocketConfig.TOPIC_PREFIX + "/")) {
      throw new MessageDeliveryException("Destino não permitido");
    }
  }
}
