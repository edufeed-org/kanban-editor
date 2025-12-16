import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type NDK from '@nostr-dev-kit/ndk';
import { Board } from '../../classes/BoardModel.js';

vi.mock('../authStore.svelte.js', () => {
    return {
        authStore: {
            getPubkey: vi.fn(() => 'owner-hex')
        }
    };
});

function createMockLocalStorage() {
    const data = new Map<string, string>();

    const storageObj: any = {
        getItem: (key: string) => data.get(key) || null,
        setItem: (key: string, value: string) => {
            data.set(key, value);
            storageObj[key] = value;
        },
        removeItem: (key: string) => {
            data.delete(key);
            delete storageObj[key];
        },
        clear: () => {
            data.clear();
            Object.keys(storageObj).forEach(k => {
                if (!['getItem', 'setItem', 'removeItem', 'clear', 'length', 'key'].includes(k)) {
                    delete storageObj[k];
                }
            });
        },
        get length() {
            return data.size;
        },
        key: (index: number) => {
            const keys = Array.from(data.keys());
            return keys[index] || null;
        }
    };

    return storageObj as Storage;
}

describe('BoardSharingOperations.addEditor', () => {
    beforeEach(() => {
        globalThis.localStorage = createMockLocalStorage();
        (globalThis as any).window = {};

        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('verhindert das Hinzufügen des Owners als Editor', async () => {
        const { BoardSharingOperations } = await import('./sharing');

        (BoardSharingOperations as any).publishBoardUpdate = vi.fn(async () => {});

        const board = new Board({
            id: 'board-1',
            name: 'Test',
            author: 'owner-hex',
            maintainers: [],
            columns: []
        });

        const ndk = {} as any as NDK;

        await expect(BoardSharingOperations.addEditor(board, 'owner-hex', ndk)).rejects.toThrow(
            'Board-Owner ist bereits Owner (kein Editor-Eintrag)'
        );

        expect(board.maintainers).toEqual([]);
        expect((BoardSharingOperations as any).publishBoardUpdate).not.toHaveBeenCalled();
    });

    it('normalisiert maintainers: entfernt Owner und dedupliziert beim Hinzufügen', async () => {
        const { BoardSharingOperations } = await import('./sharing');

        (BoardSharingOperations as any).publishBoardUpdate = vi.fn(async () => {});

        const board = new Board({
            id: 'board-2',
            name: 'Test',
            author: 'owner-hex',
            maintainers: ['owner-hex', 'editor-a', 'editor-a'],
            columns: []
        });

        const ndk = {} as any as NDK;

        await BoardSharingOperations.addEditor(board, 'editor-b', ndk);

        expect(board.maintainers).toEqual(['editor-a', 'editor-b']);
        expect((BoardSharingOperations as any).publishBoardUpdate).toHaveBeenCalledTimes(1);
    });
});
