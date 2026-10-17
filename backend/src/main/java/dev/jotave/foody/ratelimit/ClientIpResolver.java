package dev.jotave.foody.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.security.web.util.matcher.IpAddressMatcher;

/**
 * Finds the IP of the client that made the request, for per-IP rate limits.
 *
 * <p>X-Forwarded-For is just a header: any client can send one with a made-up address. It is only
 * honoured when the TCP peer ({@code remoteAddr}) is a trusted proxy, i.e. in {@code
 * app.rate-limit.trusted-proxies}. In production that is Caddy, which replaces (not appends to) the
 * X-Forwarded-For it receives from the internet, since it has no trusted proxies of its own. The
 * header is then walked right to left, skipping trusted hops, and the first untrusted address is
 * the client. With no trusted proxies configured (the default) the header is ignored and the peer
 * address is used.
 *
 * <p>Spring's {@code server.forward-headers-strategy} is deliberately left off: Tomcat's
 * RemoteIpValve trusts every private-range peer by default, which is broader than needed.
 */
public class ClientIpResolver {

  static final String X_FORWARDED_FOR = "X-Forwarded-For";

  // IP literals only: IpAddressMatcher must never be handed a hostname to resolve.
  private static final Pattern IP_LITERAL = Pattern.compile("[0-9A-Fa-f:.]{2,45}");
  private static final int MAX_CLIENT_ID_LENGTH = 45;

  private final List<IpAddressMatcher> trustedProxies;

  public ClientIpResolver(List<String> trustedProxies) {
    this.trustedProxies = trustedProxies.stream().map(IpAddressMatcher::new).toList();
  }

  public String resolve(HttpServletRequest request) {
    String peer = request.getRemoteAddr();
    String forwardedFor = request.getHeader(X_FORWARDED_FOR);
    if (!isTrusted(peer) || forwardedFor == null || forwardedFor.isBlank()) {
      return peer;
    }
    String[] hops = forwardedFor.split(",");
    for (int i = hops.length - 1; i >= 0; i--) {
      String hop = hops[i].trim();
      if (!hop.isEmpty() && !isTrusted(hop)) {
        return truncate(hop);
      }
    }
    // Every hop is one of our proxies: the request originated inside the trusted network.
    return peer;
  }

  private boolean isTrusted(String address) {
    if (address == null || !IP_LITERAL.matcher(address).matches()) {
      return false;
    }
    try {
      return trustedProxies.stream().anyMatch(m -> m.matches(address));
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  private static String truncate(String id) {
    return id.length() > MAX_CLIENT_ID_LENGTH ? id.substring(0, MAX_CLIENT_ID_LENGTH) : id;
  }
}
