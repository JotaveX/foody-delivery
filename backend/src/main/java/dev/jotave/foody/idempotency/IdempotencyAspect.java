package dev.jotave.foody.idempotency;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.jotave.foody.auth.AuthenticatedUser;
import dev.jotave.foody.idempotency.IdempotencyStore.Entry;
import dev.jotave.foody.idempotency.IdempotencyStore.State;
import dev.jotave.foody.idempotency.IdempotencyStore.StoredResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Implements {@link Idempotent}. With an {@code Idempotency-Key} header the key {@code
 * idem:{userId}:{key}} is claimed in Redis (SET NX, IN_PROGRESS, SHA-256 of the body, TTL from
 * {@code app.idempotency.ttl}) before the method runs:
 *
 * <ul>
 *   <li>claim won: the method runs; its status, Location and body are stored as COMPLETED;
 *   <li>key exists with another body hash: 422;
 *   <li>key exists, same hash, still IN_PROGRESS: 409;
 *   <li>key exists, same hash, COMPLETED: the stored response is replayed with {@code
 *       Idempotent-Replayed: true}.
 * </ul>
 *
 * <p>If the method throws (or returns a 5xx) the key is released so the client can retry. An
 * exception means no side effect was committed: the transaction rolled back, so re-running is safe.
 *
 * <p>The hash covers the body as parsed into the {@code @RequestBody} argument and re-serialized,
 * so formatting and key order do not matter. Bean Validation runs before this aspect, so an invalid
 * body is rejected with 400 without touching the key.
 */
@Aspect
@Component
public class IdempotencyAspect {

  public static final String KEY_HEADER = "Idempotency-Key";
  public static final String REPLAYED_HEADER = "Idempotent-Replayed";

  private static final Logger log = LoggerFactory.getLogger(IdempotencyAspect.class);

  private final IdempotencyStore store;
  private final ObjectMapper objectMapper;

  public IdempotencyAspect(IdempotencyStore store, ObjectMapper objectMapper) {
    this.store = store;
    this.objectMapper = objectMapper;
  }

  @Around("@annotation(dev.jotave.foody.idempotency.Idempotent)")
  public Object handle(ProceedingJoinPoint joinPoint) throws Throwable {
    Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
    if (!ResponseEntity.class.isAssignableFrom(method.getReturnType())) {
      throw new IllegalStateException("@Idempotent method must return ResponseEntity: " + method);
    }
    String header = currentRequest().getHeader(KEY_HEADER);
    if (header == null) {
      return joinPoint.proceed();
    }
    String key = "idem:%d:%s".formatted(currentUserId(), parseKey(header));
    String requestHash = sha256(requestBody(method, joinPoint.getArgs()));

    Optional<Entry> existing = store.reserve(key, requestHash);
    if (existing.isPresent()) {
      return replay(existing.get(), requestHash);
    }

    ResponseEntity<?> response;
    try {
      response = (ResponseEntity<?>) joinPoint.proceed();
    } catch (Throwable e) {
      store.release(key);
      throw e;
    }
    if (response.getStatusCode().is5xxServerError()) {
      store.release(key);
      return response;
    }
    try {
      store.complete(key, requestHash, toStored(response));
    } catch (RuntimeException e) {
      // The request itself succeeded; a retry would be told 409 until the TTL expires.
      log.error("Could not store idempotent response for {}", key, e);
    }
    return response;
  }

  private static ResponseEntity<String> replay(Entry entry, String requestHash) {
    if (!entry.requestHash().equals(requestHash)) {
      throw new IdempotencyKeyReusedException();
    }
    if (entry.state() == State.IN_PROGRESS) {
      throw new IdempotentRequestInProgressException();
    }
    StoredResponse stored = entry.response();
    // A String body is written verbatim by StringHttpMessageConverter: the exact stored JSON.
    return ResponseEntity.status(stored.status())
        .headers(
            headers -> {
              stored.headers().forEach(headers::set);
              headers.set(REPLAYED_HEADER, "true");
            })
        .contentType(MediaType.APPLICATION_JSON)
        .body(stored.body());
  }

  private StoredResponse toStored(ResponseEntity<?> response) throws JsonProcessingException {
    Map<String, String> headers = new LinkedHashMap<>();
    String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
    if (location != null) {
      headers.put(HttpHeaders.LOCATION, location);
    }
    String body = response.hasBody() ? objectMapper.writeValueAsString(response.getBody()) : null;
    return new StoredResponse(response.getStatusCode().value(), headers, body);
  }

  private byte[] requestBody(Method method, Object[] args) throws JsonProcessingException {
    Annotation[][] annotations = method.getParameterAnnotations();
    for (int i = 0; i < annotations.length; i++) {
      for (Annotation annotation : annotations[i]) {
        if (annotation instanceof RequestBody) {
          return objectMapper.writeValueAsBytes(args[i]);
        }
      }
    }
    return new byte[0];
  }

  private static UUID parseKey(String header) {
    try {
      String trimmed = header.trim();
      UUID key = UUID.fromString(trimmed);
      // UUID.fromString accepts shortened forms like "1-2-3-4-5"; require the canonical one.
      if (!key.toString().equalsIgnoreCase(trimmed)) {
        throw new InvalidIdempotencyKeyException();
      }
      return key;
    } catch (IllegalArgumentException e) {
      throw new InvalidIdempotencyKeyException();
    }
  }

  private static long currentUserId() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
      return user.id();
    }
    throw new IllegalStateException("@Idempotent requires an authenticated request");
  }

  private static HttpServletRequest currentRequest() {
    if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
      return attrs.getRequest();
    }
    throw new IllegalStateException("@Idempotent used outside of an HTTP request");
  }

  private static String sha256(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
