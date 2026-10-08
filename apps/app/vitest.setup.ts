import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// happy-dom rejects `finished` on `cancel()` without marking it handled, unlike the Web Animations
// spec, so every animation motion stops surfaces as an unhandled rejection
// (https://github.com/capricorn86/happy-dom/issues/2339).
const cancel = Reflect.get<Animation, 'cancel'>(Animation.prototype, 'cancel')
Animation.prototype.cancel = function (this: Animation) {
  this.finished.catch(() => undefined)
  cancel.call(this)
}
