package dev.jotave.foody.order;

import dev.jotave.foody.auth.AuthenticatedUser;
import dev.jotave.foody.idempotency.Idempotent;
import dev.jotave.foody.order.OrderResponses.HistoryEntry;
import dev.jotave.foody.order.OrderResponses.OrderDetail;
import dev.jotave.foody.order.OrderResponses.OrderSummary;
import dev.jotave.foody.order.OrderResponses.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/orders")
@SecurityRequirement(name = "bearer")
public class OrderController {

  private final OrderService orderService;

  public OrderController(OrderService orderService) {
    this.orderService = orderService;
  }

  @Operation(
      summary = "Create an order",
      description =
          "Send exactly one of addressId (an active address of yours) or newAddress (added to your"
              + " profile; saveAsDefault makes it the default). An optional Idempotency-Key header"
              + " (UUID) makes retries safe: the same key and body replay the first response.")
  @Idempotent
  @PostMapping
  public ResponseEntity<OrderDetail> create(
      @AuthenticationPrincipal AuthenticatedUser principal,
      @Valid @RequestBody CreateOrderRequest request) {
    OrderDetail order = orderService.create(principal.id(), request);
    return ResponseEntity.created(URI.create("/orders/" + order.id())).body(order);
  }

  @Operation(summary = "List orders, newest first")
  @GetMapping
  public PageResponse<OrderSummary> list(
      @Parameter(description = "Only orders in this status") @RequestParam(required = false)
          OrderStatus status,
      @RequestParam(defaultValue = "0") int page,
      @Parameter(description = "Page size, 1 to " + OrderService.MAX_PAGE_SIZE)
          @RequestParam(defaultValue = "20")
          int size) {
    return orderService.list(status, page, size);
  }

  @Operation(summary = "Order with items, total and delivery address")
  @GetMapping("/{id}")
  public OrderDetail get(@PathVariable long id) {
    return orderService.get(id);
  }

  @Operation(summary = "Move the order to another status")
  @PatchMapping("/{id}/status")
  public OrderDetail changeStatus(
      @AuthenticationPrincipal AuthenticatedUser principal,
      @PathVariable long id,
      @Valid @RequestBody ChangeStatusRequest request) {
    return orderService.changeStatus(id, request.status(), principal.id());
  }

  @Operation(summary = "Status history, oldest first")
  @GetMapping("/{id}/history")
  public List<HistoryEntry> history(@PathVariable long id) {
    return orderService.history(id);
  }
}
