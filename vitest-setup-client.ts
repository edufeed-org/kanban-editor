// Client test setup (jsdom)
// - Provides small browser API polyfills that jsdom doesn't implement by default
// - Keeps localStorage available for stores during tests
if (typeof localStorage === 'undefined') {
  const localStorageMock: Storage = (() => {
    let store: Record<string, string> = {};
    
    return {
      getItem(key: string): string | null {
        return store[key] || null;
      },
      setItem(key: string, value: string): void {
        store[key] = String(value);
      },
      removeItem(key: string): void {
        delete store[key];
      },
      clear(): void {
        store = {};
      },
      key(index: number): string | null {
        const keys = Object.keys(store);
        return keys[index] || null;
      },
      get length(): number {
        return Object.keys(store).length;
      }
    };
  })();
  
  // @ts-ignore - global polyfill for Node environment
  global.localStorage = localStorageMock;
}

// jsdom does not implement matchMedia by default.
// Our SettingsStore uses it for prefers-color-scheme detection.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => {
    const mql: MediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {
        // deprecated
      },
      removeListener: () => {
        // deprecated
      },
      addEventListener: () => {
        // no-op
      },
      removeEventListener: () => {
        // no-op
      },
      dispatchEvent: () => false
    };
    return mql;
  };
}
