package dev.jotave.foody.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIpResolverTest {

  private final ClientIpResolver behindCaddy = new ClientIpResolver(List.of("172.16.0.0/12"));

  @Test
  void ignoresForwardedForWhenNoProxyIsTrusted() {
    var resolver = new ClientIpResolver(List.of());

    assertThat(resolver.resolve(request("172.18.0.5", "203.0.113.7"))).isEqualTo("172.18.0.5");
  }

  @Test
  void ignoresForwardedForFromAnUntrustedPeer() {
    // A client talking to the app directly cannot pick its own rate-limit bucket.
    assertThat(behindCaddy.resolve(request("198.51.100.9", "203.0.113.7")))
        .isEqualTo("198.51.100.9");
  }

  @Test
  void usesForwardedForFromATrustedProxy() {
    assertThat(behindCaddy.resolve(request("172.18.0.5", "203.0.113.7"))).isEqualTo("203.0.113.7");
  }

  @Test
  void takesTheRightmostUntrustedHop() {
    // The leftmost entry is whatever the client claimed; only hops added by our proxies count.
    assertThat(behindCaddy.resolve(request("172.18.0.5", "10.9.9.9, 203.0.113.7, 172.18.0.2")))
        .isEqualTo("203.0.113.7");
  }

  @Test
  void fallsBackToThePeerWhenEveryHopIsTrusted() {
    assertThat(behindCaddy.resolve(request("172.18.0.5", "172.18.0.2"))).isEqualTo("172.18.0.5");
    assertThat(behindCaddy.resolve(request("172.18.0.5", " "))).isEqualTo("172.18.0.5");
  }

  @Test
  void neverResolvesHostnames() {
    assertThat(behindCaddy.resolve(request("172.18.0.5", "203.0.113.7, localhost")))
        .isEqualTo("localhost");
  }

  @Test
  void matchesIpv6Loopback() {
    var resolver = new ClientIpResolver(List.of("::1"));

    assertThat(resolver.resolve(request("0:0:0:0:0:0:0:1", "203.0.113.7")))
        .isEqualTo("203.0.113.7");
  }

  private static MockHttpServletRequest request(String peer, String forwardedFor) {
    var request = new MockHttpServletRequest();
    request.setRemoteAddr(peer);
    request.addHeader(ClientIpResolver.X_FORWARDED_FOR, forwardedFor);
    return request;
  }
}
