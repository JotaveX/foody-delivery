// jsdom has no AnimationEvent, which makes React listen for a vendor-prefixed "animationend" that
// fireEvent.animationEnd never dispatches. Must run before react-dom is first imported.
if (!('AnimationEvent' in window)) {
  class AnimationEvent extends Event {
    readonly animationName: string
    readonly elapsedTime: number
    readonly pseudoElement: string
    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init)
      this.animationName = init.animationName ?? ''
      this.elapsedTime = init.elapsedTime ?? 0
      this.pseudoElement = init.pseudoElement ?? ''
    }
  }
  Object.assign(window, { AnimationEvent })
}
