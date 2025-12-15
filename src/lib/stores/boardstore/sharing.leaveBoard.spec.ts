import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type NDK from '@nostr-dev-kit/ndk';
import { BoardSharingOperations } from './sharing';

const HIDDEN_KEY = 'nostr-kanban-hidden-boards-v1';

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

describe('BoardSharingOperations.leaveBoard', () => {
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

    it('versteckt ein geteiltes Board lokal und entfernt lokalen Cache (Editor-Fall, kein unfollow)', async () => {
        const boardId = 'board-123';
        const boardAuthor = 'author-hex-abc';
        const currentUserPubkey = 'me-hex-123';

        localStorage.setItem(`kanban-${boardId}`, JSON.stringify({ id: boardId, name: 'Cached' }));

        const ndk = {
            fetchEvent: vi.fn(async () => ({
                pubkey: boardAuthor,
                tags: [
                    ['d', boardId],
                    ['title', 'Shared Board'],
                    ['p', currentUserPubkey]
                ]
            }))
        } as any as NDK;

        const unfollowSpy = vi
            .spyOn(BoardSharingOperations, 'unfollowBoard')
            .mockResolvedValue(undefined);

        await BoardSharingOperations.leaveBoard(boardId, currentUserPubkey, ndk, boardAuthor);

        expect(localStorage.getItem(`kanban-${boardId}`)).toBeNull();

        const hiddenRaw = localStorage.getItem(HIDDEN_KEY);
        expect(hiddenRaw).not.toBeNull();
        const hidden = JSON.parse(hiddenRaw as string);
        const addr = `30301:${boardAuthor}:${boardId}`;
        expect(hidden.byAddress[addr]).toBeTruthy();
        expect(hidden.byAddress[addr].reason).toBe('left');

        expect(unfollowSpy).not.toHaveBeenCalled();
    });

    it('versteckt ein Board lokal und versucht unfollow (Viewer-Fall)', async () => {
        const boardId = 'board-456';
        const boardAuthor = 'author-hex-def';
        const currentUserPubkey = 'me-hex-456';

        localStorage.setItem(`kanban-${boardId}`, JSON.stringify({ id: boardId, name: 'Cached' }));

        const ndk = {
            fetchEvent: vi.fn(async () => ({
                pubkey: boardAuthor,
                tags: [
                    ['d', boardId],
                    ['title', 'Followed Board']
                    // kein p-tag für currentUser => viewer
                ]
            }))
        } as any as NDK;

        const unfollowSpy = vi
            .spyOn(BoardSharingOperations, 'unfollowBoard')
            .mockResolvedValue(undefined);

        await BoardSharingOperations.leaveBoard(boardId, currentUserPubkey, ndk, boardAuthor);

        expect(localStorage.getItem(`kanban-${boardId}`)).toBeNull();
        expect(unfollowSpy).toHaveBeenCalledWith(boardId, boardAuthor, ndk);

        const hiddenRaw = localStorage.getItem(HIDDEN_KEY);
        expect(hiddenRaw).not.toBeNull();
        const hidden = JSON.parse(hiddenRaw as string);
        const addr = `30301:${boardAuthor}:${boardId}`;
        expect(hidden.byAddress[addr]).toBeTruthy();
    });

    it('filtert versteckte Boards beim Laden geteilter Boards (p-tags)', async () => {
        const boardId = 'board-hidden';
        const boardAuthor = 'author-hex-zzz';
        const currentUserPubkey = 'me-hex-zzz';

        // Hide zuerst setzen
        BoardSharingOperations.hideBoard(boardId, boardAuthor, 'left');

        const boardEvent = {
            pubkey: boardAuthor,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['d', boardId],
                ['title', 'Hidden Shared Board'],
                ['p', currentUserPubkey]
            ]
        };

        const ndk = {
            fetchEvents: vi.fn(async () => new Set([boardEvent])),
            fetchEvent: vi.fn(async () => null)
        } as any as NDK;

        const result = await BoardSharingOperations.loadSharedBoardsFromNostr(currentUserPubkey, ndk);
        expect(result).toEqual([]);
    });
});
