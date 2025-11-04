/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />

// Mock localStorage for tests that run in server environment (Node.js)
// This is needed for stores that use localStorage but run in Node tests
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
