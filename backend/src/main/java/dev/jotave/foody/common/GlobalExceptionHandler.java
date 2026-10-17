package dev.jotave.foody.common;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import dev.jotave.foody.observability.CorrelationIdFilter;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Every error leaves the API as RFC 9457 ProblemDetail with a Portuguese message. Domain errors
 * extend {@link org.springframework.web.ErrorResponseException} (404, 409, 422…) and are rendered
 * by the base class; this class covers request validation, concurrency conflicts and the catch-all
 * 500.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    Map<String, String> errors = new LinkedHashMap<>();
    ex.getBindingResult()
        .getFieldErrors()
        .forEach(e -> errors.putIfAbsent(e.getField(), e.getDefaultMessage()));
    return handleExceptionInternal(
        ex, invalid("Dados inválidos.", errors), headers, status, request);
  }

  @Override
  protected ResponseEntity<Object> handleHttpMessageNotReadable(
      HttpMessageNotReadableException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail problem;
    if (ex.getCause() instanceof InvalidFormatException invalid
        && invalid.getTargetType() != null
        && invalid.getTargetType().isEnum()) {
      // e.g. {"status": "VOANDO"}: name the field and list the accepted values.
      String field = fieldPath(invalid);
      problem =
          invalid(
              "Valor inválido para o campo %s: %s.".formatted(field, invalid.getValue()),
              Map.of(field, acceptedValues(invalid.getTargetType())));
    } else {
      problem =
          ProblemDetail.forStatusAndDetail(
              HttpStatus.BAD_REQUEST, "Corpo da requisição ausente ou malformado.");
    }
    return handleExceptionInternal(ex, problem, headers, status, request);
  }

  @Override
  protected ResponseEntity<Object> handleTypeMismatch(
      TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    String name =
        ex instanceof MethodArgumentTypeMismatchException mismatch
            ? mismatch.getName()
            : ex.getPropertyName();
    Class<?> type = ex.getRequiredType();
    String hint =
        type != null && type.isEnum() ? acceptedValues(type) : "Valor em formato inválido.";
    ProblemDetail problem =
        invalid(
            "Valor inválido para o parâmetro %s: %s.".formatted(name, ex.getValue()),
            Map.of(String.valueOf(name), hint));
    return handleExceptionInternal(ex, problem, headers, status, request);
  }

  /** Someone else changed the same row between our read and our write (@Version mismatch). */
  @ExceptionHandler(OptimisticLockingFailureException.class)
  ProblemDetail handleOptimisticLock() {
    return ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT,
        "O registro foi alterado por outra requisição. Recarregue e tente novamente.");
  }

  /**
   * A concurrent write won the race: a unique index (e.g. the single default address) rejected
   * ours, or SQLite stayed locked past busy_timeout.
   */
  @ExceptionHandler({DataIntegrityViolationException.class, ConcurrencyFailureException.class})
  ProblemDetail handleConcurrentModification() {
    return ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT, "O recurso foi alterado por outra operação. Tente novamente.");
  }

  /**
   * Last resort: log the full stack trace, but answer with a generic message and the correlation id
   * so the failure can be found in the logs. Never leaks internals to the client.
   */
  @ExceptionHandler(Exception.class)
  ProblemDetail handleUnexpected(Exception ex) throws Exception {
    if (ex instanceof AccessDeniedException || ex instanceof AuthenticationException) {
      throw ex; // let Spring Security render its own 401/403
    }
    String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
    log.error("Unexpected error (correlationId={})", correlationId, ex);
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Erro inesperado. Se o problema persistir, informe o código de rastreio.");
    problem.setProperty("correlationId", correlationId);
    return problem;
  }

  private static ProblemDetail invalid(String detail, Map<String, String> errors) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
    problem.setProperty("errors", errors);
    return problem;
  }

  private static String fieldPath(MismatchedInputException ex) {
    return ex.getPath().stream()
        .map(ref -> ref.getFieldName() != null ? ref.getFieldName() : "[" + ref.getIndex() + "]")
        .collect(Collectors.joining("."))
        .replace(".[", "[");
  }

  private static String acceptedValues(Class<?> enumType) {
    return "Valores aceitos: "
        + Arrays.stream(enumType.getEnumConstants())
            .map(Object::toString)
            .collect(Collectors.joining(", "))
        + ".";
  }
}
