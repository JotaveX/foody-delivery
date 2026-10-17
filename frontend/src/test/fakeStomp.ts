import type { IMessage, StompConfig } from '@stomp/stompjs'

type Handler = (message: IMessage) => void

/**
 * Stand-in for the @stomp/stompjs Client, installed for every test in setup.ts so no test opens a
 * real socket. Tests drive it through the simulate* helpers.
 */
export class FakeStompClient {
  static instances: FakeStompClient[] = []

  active = false
  readonly subscriptions = new Map<string, Handler>()
  readonly config: StompConfig

  constructor(config: StompConfig) {
    this.config = config
    FakeStompClient.instances.push(this)
  }

  static get latest() {
    return FakeStompClient.instances.at(-1)
  }

  activate() {
    this.active = true
  }

  async deactivate() {
    this.active = false
    this.subscriptions.clear()
  }

  subscribe(destination: string, handler: Handler) {
    this.subscriptions.set(destination, handler)
    return { id: destination, unsubscribe: () => this.subscriptions.delete(destination) }
  }

  simulateConnect() {
    this.config.onConnect?.({} as never)
  }

  /** The socket dropped; the real client would now retry with backoff. */
  simulateClose() {
    this.subscriptions.clear()
    this.config.onWebSocketClose?.({} as never)
  }

  deliver(destination: string, body: unknown) {
    this.subscriptions.get(destination)?.({ body: JSON.stringify(body) } as IMessage)
  }
}
