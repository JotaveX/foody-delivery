package dev.jotave.foody.order;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
class OrderEventsConfig {

  @Bean
  RedisMessageListenerContainer orderEventsListenerContainer(
      RedisConnectionFactory connectionFactory, OrderEventsRelay relay) {
    var container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(relay, new ChannelTopic(OrderEventsPublisher.CHANNEL));
    return container;
  }
}
