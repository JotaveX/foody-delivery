package dev.jotave.foody.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.jotave.foody.ratelimit.ClientIpResolver;
import dev.jotave.foody.ratelimit.RateLimitFilter;
import dev.jotave.foody.ratelimit.RateLimitProperties;
import dev.jotave.foody.ratelimit.RateLimiter;
import dev.jotave.foody.user.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      JwtService jwtService,
      UserRepository users,
      ObjectMapper objectMapper,
      RateLimiter rateLimiter,
      ClientIpResolver clientIpResolver,
      RateLimitProperties rateLimitProperties)
      throws Exception {
    var problemHandler = new ProblemDetailSecurityHandler(objectMapper);
    return http.csrf(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .logout(AbstractHttpConfigurer::disable)
        .requestCache(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth
                    // Order matters: /auth/me is the only protected route under /auth.
                    .requestMatchers("/auth/me")
                    .authenticated()
                    .requestMatchers(
                        "/auth/**",
                        "/actuator/health/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        // WebSocket handshakes authenticate on their own.
                        "/ws/**",
                        "/error")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            e -> e.authenticationEntryPoint(problemHandler).accessDeniedHandler(problemHandler))
        .addFilterBefore(
            new JwtAuthenticationFilter(jwtService, users),
            UsernamePasswordAuthenticationFilter.class)
        // After authentication, so the per-user limit knows who is calling.
        .addFilterAfter(
            new RateLimitFilter(rateLimiter, clientIpResolver, rateLimitProperties, objectMapper),
            JwtAuthenticationFilter.class)
        .build();
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }
}
