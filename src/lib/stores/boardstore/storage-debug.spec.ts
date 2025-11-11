// Debug-Test um localStorage Mock zu verifizieren

import { describe, it, expect, beforeEach } from 'vitest';

describe('localStorage Mock Debug', () => {
    let mockLocalStorage: Map<string, string>;

    beforeEach(() => {
        mockLocalStorage = new Map();

        const storageObj: any = {
            getItem: (key: string) => mockLocalStorage.get(key) || null,
            setItem: (key: string, value: string) => {
                mockLocalStorage.set(key, value);
                storageObj[key] = value;
            },
            removeItem: (key: string) => {
                mockLocalStorage.delete(key);
                delete storageObj[key];
            },
            clear: () => {
                mockLocalStorage.clear();
                Object.keys(storageObj).forEach(k => {
                    if (!['getItem', 'setItem', 'removeItem', 'clear', 'length', 'key'].includes(k)) {
                        delete storageObj[k];
                    }
                });
            },
            get length() {
                return mockLocalStorage.size;
            },
            key: (index: number) => {
                const keys = Array.from(mockLocalStorage.keys());
                return keys[index] || null;
            }
        };

        globalThis.localStorage = storageObj as Storage;
    });

    it('sollte Keys via Object.keys() zugänglich machen', () => {
        // Setup
        localStorage.setItem('kanban-board-123', 'value1');
        localStorage.setItem('kanban-config', 'value2');
        localStorage.setItem('kanban-settings', 'value3');

        // Debug: Was ist in localStorage?
        console.log('=== DEBUG ===');
        console.log('localStorage:', localStorage);
        console.log('Object.keys(localStorage):', Object.keys(localStorage));
        console.log('localStorage.length:', localStorage.length);
        console.log('localStorage.key(0):', localStorage.key(0));
        console.log('localStorage.getItem("kanban-board-123"):', localStorage.getItem('kanban-board-123'));

        // Verify
        const keys = Object.keys(localStorage);
        console.log('Keys gefunden:', keys);

        expect(keys).toContain('kanban-board-123');
        expect(keys).toContain('kanban-config');
        expect(keys).toContain('kanban-settings');
    });
});
