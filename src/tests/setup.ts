import '@testing-library/jest-dom/vitest'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length() { return storage.size },
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => [...storage.keys()][index] ?? null,
    removeItem: (key: string) => { storage.delete(key) },
    setItem: (key: string, value: string) => { storage.set(key, String(value)) },
  } satisfies Storage,
})

// jsdom has neither a native dialog top layer nor an audio decoder.
// These stubs cover component state; focus containment and playback need a browser.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value(this: HTMLDialogElement) { this.setAttribute('open', '') },
})
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value(this: HTMLDialogElement) { this.removeAttribute('open') },
})
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: () => {} })
