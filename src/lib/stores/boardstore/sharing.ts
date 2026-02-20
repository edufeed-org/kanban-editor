// src/lib/stores/boardstore/sharing.ts
// Board-Sharing & Maintainer-System API

import { Board, type BoardProps } from '../../classes/BoardModel.js';
import { BoardRole, type BoardShare } from '../../types/sharing.js';
import { authStore } from '../authStore.svelte.js';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, nip19 } from '@nostr-dev-kit/ndk';

type HiddenBoardEntry = {
    hiddenAt: string;
    reason: 'left' | 'hidden';
    source?: 'local' | 'nostr';
    boardId: string;
    boardAuthor?: string;
};

type HiddenBoardsRegistryV1 = {
    byId: Record<string, HiddenBoardEntry>;
    byAddress: Record<string, HiddenBoardEntry>; // key: 30301:{author}:{d}
};

const HIDDEN_BOARDS_KEY = 'nostr-kanban-hidden-boards-v1';

const FOLLOW_SET_D_TAG = 'kanban-boards';
const LEFT_BOARDS_D_TAG = 'kanban-left-boards';
const LEAVE_REQUEST_D_TAG_PREFIX = 'kanban-leave-request:';
const EDITOR_REQUEST_D_TAG_PREFIX = 'kanban-editor-request:';

export type LeaveRequestInfo = {
    eventId: string;
    createdAt?: number;
};

export type EditorRequestInfo = {
    eventId: string;
    createdAt?: number;
    reason?: string;
    role?: string;
};

export class BoardSharingOperations {

    private static loadHiddenBoardsRegistry(): HiddenBoardsRegistryV1 {
        if (typeof window === 'undefined') {
            return { byId: {}, byAddress: {} };
        }

        try {
            const raw = localStorage.getItem(HIDDEN_BOARDS_KEY);
            if (!raw) return { byId: {}, byAddress: {} };
            const parsed = JSON.parse(raw) as Partial<HiddenBoardsRegistryV1>;
            const byId = parsed.byId || {};
            const byAddress = parsed.byAddress || {};

            // Backwards-compat: ältere Einträge hatten kein `source` Feld.
            for (const entry of Object.values(byId)) {
                if (entry && !('source' in entry)) {
                    (entry as HiddenBoardEntry).source = 'local';
                }
            }
            for (const entry of Object.values(byAddress)) {
                if (entry && !('source' in entry)) {
                    (entry as HiddenBoardEntry).source = 'local';
                }
            }

            return { byId, byAddress };
        } catch {
            return { byId: {}, byAddress: {} };
        }
    }

    private static saveHiddenBoardsRegistry(registry: HiddenBoardsRegistryV1): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(HIDDEN_BOARDS_KEY, JSON.stringify(registry));
    }

    public static makeBoardAddress(boardId: string, boardAuthor: string): string {
        return `30301:${boardAuthor}:${boardId}`;
    }

    public static isBoardHidden(boardId: string, boardAuthor?: string): boolean {
        const registry = this.loadHiddenBoardsRegistry();
        // ⚠️ Wichtig: Wenn der Author bekannt ist, MUSS die Prüfung author-scoped sein.
        // Sonst kann ein alter byId-Eintrag (ohne Author) fälschlich auch andere Boards
        // mit gleicher d-tag-ID verstecken (z.B. nach Leave/Unfollow ohne author-Info).
        if (boardAuthor) {
            const addr = this.makeBoardAddress(boardId, boardAuthor);
            return !!registry.byAddress[addr];
        }
        return !!registry.byId[boardId];
    }

    public static hideBoard(boardId: string, boardAuthor?: string, reason: HiddenBoardEntry['reason'] = 'left'): void {
        const registry = this.loadHiddenBoardsRegistry();
        const entry: HiddenBoardEntry = {
            boardId,
            boardAuthor,
            reason,
            source: 'local',
            hiddenAt: new Date().toISOString()
        };

        // Speichere author-scoped (präferiert). byId bleibt als Fallback für Legacy/unknown author.
        if (boardAuthor) {
            const addr = this.makeBoardAddress(boardId, boardAuthor);
            // Wenn bereits ein Eintrag existiert, überschreiben wir nicht blind (z.B. um `hiddenAt` nicht zu churnen).
            registry.byAddress[addr] = registry.byAddress[addr] || entry;
        } else {
            registry.byId[boardId] = registry.byId[boardId] || entry;
        }

        this.saveHiddenBoardsRegistry(registry);
    }

    public static unhideBoard(boardId: string, boardAuthor?: string): void {
        const registry = this.loadHiddenBoardsRegistry();
        delete registry.byId[boardId];
        if (boardAuthor) {
            delete registry.byAddress[this.makeBoardAddress(boardId, boardAuthor)];
        }
        this.saveHiddenBoardsRegistry(registry);
    }

    private static applyLeftBoardsFromNostrRefs(refs: string[]): { added: number; removed: number; total: number } {
        const registry = this.loadHiddenBoardsRegistry();

        const desiredAddresses = new Set<string>();

        let added = 0;
        let removed = 0;

        for (const ref of refs) {
            // expected: 30301:<author>:<d>
            const parts = ref.split(':');
            if (parts.length !== 3) continue;
            const [kind, author, dTag] = parts;
            if (kind !== '30301' || !author || !dTag) continue;

            const addr = this.makeBoardAddress(dTag, author);
            desiredAddresses.add(addr);

            if (!registry.byAddress[addr]) {
                registry.byAddress[addr] = {
                    boardId: dTag,
                    boardAuthor: author,
                    reason: 'left',
                    source: 'nostr',
                    hiddenAt: new Date().toISOString(),
                };
                added++;
            } else {
                // Falls vorhanden, aber ohne source (Legacy), normalisieren.
                registry.byAddress[addr].source = registry.byAddress[addr].source || 'local';
            }
        }

        // Entferne stale Nostr-sourced Left-Entries, die nicht mehr im List-Event stehen.
        for (const [addr, entry] of Object.entries(registry.byAddress)) {
            if (entry?.source === 'nostr' && entry.reason === 'left' && !desiredAddresses.has(addr)) {
                delete registry.byAddress[addr];
                removed++;
            }
        }

        this.saveHiddenBoardsRegistry(registry);

        return { added, removed, total: desiredAddresses.size };
    }

    /**
     * Cross-Device Leave Persistence:
     * Lädt die NIP-51 Liste (Kind 30000, d=kanban-left-boards) und synchronisiert sie in die lokale Hide-Registry.
     *
     * Wichtig: Read-only. Funktioniert auch ohne Signer.
     */
    public static async syncLeftBoardsFromNostr(currentUserPubkey: string, ndk: NDK): Promise<void> {
        if (!ndk || !currentUserPubkey) return;

        try {
            const leftSetEvent: any = await ndk.fetchEvent({
                kinds: [30000],
                authors: [currentUserPubkey],
                '#d': [LEFT_BOARDS_D_TAG],
            } as any);

            if (!leftSetEvent) return;

            const refs = (leftSetEvent.tags || [])
                .filter((t: any) => t[0] === 'a')
                .map((t: any) => t[1])
                .filter(Boolean);

            const shortUser = currentUserPubkey.slice(0, 12);
            console.log(`\n📥 NIP-51 Left-Boards geladen (d=${LEFT_BOARDS_D_TAG})`, {
                user: `${shortUser}…`,
                eventId: leftSetEvent.id,
                refs: refs.length,
            });

            const result = this.applyLeftBoardsFromNostrRefs(refs);
            console.log('✅ Left-Boards → Hide-Registry sync', result);
        } catch (error) {
            console.warn('⚠️ syncLeftBoardsFromNostr fehlgeschlagen (best-effort):', error);
        }
    }

    private static async upsertLeftBoardsList(boardRef: string, op: 'add' | 'remove', ndk: NDK): Promise<void> {
        // Ohne Signer können wir nicht publizieren. Lokale Hide-Registry ist dann Source-of-Truth.
        if (!ndk?.signer) {
            console.log('ℹ️ NIP-51 Left-Boards: Kein Signer – publish übersprungen (nur lokales Hide)', {
                op,
                boardRef,
            });
            return;
        }

        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            console.log('ℹ️ NIP-51 Left-Boards: Kein User-Pubkey – publish übersprungen', {
                op,
                boardRef,
            });
            return;
        }

        const existing: any = await ndk.fetchEvent({
            kinds: [30000],
            authors: [currentUser],
            '#d': [LEFT_BOARDS_D_TAG],
        } as any);

        const existingRefs = new Set<string>(
            (existing?.tags || [])
                .filter((t: any) => t[0] === 'a')
                .map((t: any) => t[1])
                .filter(Boolean)
        );

        if (op === 'add') existingRefs.add(boardRef);
        if (op === 'remove') existingRefs.delete(boardRef);

        const ev = new NDKEvent(ndk);
        ev.kind = 30000;
        ev.tags = [['d', LEFT_BOARDS_D_TAG]];

        for (const ref of Array.from(existingRefs)) {
            ev.tags.push(['a', ref]);
        }

        const relays = await ev.publish();
        console.log('✅ NIP-51 Left-Boards publiziert', {
            op,
            d: LEFT_BOARDS_D_TAG,
            boardRef,
            eventId: ev.id,
            relays: relays?.size ?? 0,
        });
    }

    private static async publishLeaveRequest(boardRef: string, ownerPubkey: string, ndk: NDK): Promise<void> {
        // Ohne Signer können wir nicht publizieren.
        if (!ndk?.signer) {
            console.log('ℹ️ Leave-Request: Kein Signer – publish übersprungen', {
                boardRef,
                owner: `${ownerPubkey.slice(0, 12)}…`,
            });
            return;
        }

        const ev = new NDKEvent(ndk);
        ev.kind = 30000;
        ev.tags = [
            ['d', `${LEAVE_REQUEST_D_TAG_PREFIX}${boardRef}`],
            ['a', boardRef],
            ['p', ownerPubkey],
        ];
        ev.content = 'leave';

        const relays = await ev.publish();
        console.log('✅ Leave-Request publiziert', {
            boardRef,
            owner: `${ownerPubkey.slice(0, 12)}…`,
            eventId: ev.id,
            relays: relays?.size ?? 0,
        });
    }

    private static async publishEditorRoleRequest(
        boardRef: string,
        ownerPubkey: string,
        ndk: NDK,
        reason?: string,
        role: string = 'editor'
    ): Promise<void> {
        if (!ndk?.signer) {
            console.log('ℹ️ Editor-Request: Kein Signer – publish übersprungen', {
                boardRef,
                owner: `${ownerPubkey.slice(0, 12)}…`,
            });
            return;
        }

        const ev = new NDKEvent(ndk);
        ev.kind = 30000;
        ev.tags = [
            ['d', `${EDITOR_REQUEST_D_TAG_PREFIX}${boardRef}`],
            ['a', boardRef],
            ['p', ownerPubkey],
            ['role', role]
        ];

        if (reason) {
            ev.tags.push(['reason', reason]);
        }

        ev.content = 'editor-request';

        const relays = await ev.publish();
        console.log('✅ Editor-Request publiziert', {
            boardRef,
            owner: `${ownerPubkey.slice(0, 12)}…`,
            eventId: ev.id,
            relays: relays?.size ?? 0,
        });
    }

    /**
     * Viewer: Request Editor-Role für ein Board.
     */
    public static async requestEditorRole(
        board: Board,
        ndk: NDK,
        reason?: string
    ): Promise<void> {
        if (!board?.id || !board?.author) {
            throw new Error('Board-Daten unvollständig');
        }

        const boardRef = this.makeBoardAddress(board.id, board.author);
        await this.publishEditorRoleRequest(boardRef, board.author, ndk, reason);
    }

    /**
     * Owner-Sichtbarkeit: lädt Leave-Requests (Kind 30000) für ein Board.
     *
     * Events werden von den jeweiligen Requestern publiziert und enthalten:
     * - d = kanban-leave-request:<boardRef>
     * - a = <boardRef>
     * - p = <ownerPubkey>
     *
     * Rückgabe: Map requesterPubkey -> { eventId, createdAt }
     */
    public static async loadLeaveRequestsForBoard(
        boardRef: string,
        ndk: NDK
    ): Promise<Record<string, LeaveRequestInfo>> {
        if (!ndk || !boardRef) return {};

        const dTag = `${LEAVE_REQUEST_D_TAG_PREFIX}${boardRef}`;
        const filter: any = {
            kinds: [30000],
            '#d': [dTag],
        };

        try {
            let events: Set<any> = new Set();

            if (typeof (ndk as any).fetchEvents === 'function') {
                events = await (ndk as any).fetchEvents(filter);
            } else if (typeof (ndk as any).fetchEvent === 'function') {
                const single = await (ndk as any).fetchEvent(filter);
                if (single) events = new Set([single]);
            }

            const result: Record<string, LeaveRequestInfo> = {};
            for (const ev of Array.from(events || [])) {
                const requester = ev?.pubkey;
                const eventId = ev?.id;
                if (!requester || !eventId) continue;

                // Best-effort: nur Events akzeptieren, die wirklich zum d-tag passen
                const hasD = (ev.tags || []).some((t: any) => t?.[0] === 'd' && t?.[1] === dTag);
                if (!hasD) continue;

                const createdAt = typeof ev.created_at === 'number' ? ev.created_at : undefined;
                result[requester] = {
                    eventId,
                    createdAt,
                };
            }
            return result;
        } catch (error) {
            console.warn('⚠️ loadLeaveRequestsForBoard fehlgeschlagen (best-effort):', error);
            return {};
        }
    }

    /**
     * Owner-Sichtbarkeit: lädt Editor-Requests (Kind 30000) für ein Board.
     *
     * Events werden von den jeweiligen Requestern publiziert und enthalten:
     * - d = kanban-editor-request:<boardRef>
     * - a = <boardRef>
     * - p = <ownerPubkey>
     * - role = editor
     * - reason = optional
     */
    public static async loadEditorRequestsForBoard(
        boardRef: string,
        ndk: NDK
    ): Promise<Record<string, EditorRequestInfo>> {
        if (!ndk || !boardRef) return {};

        const dTag = `${EDITOR_REQUEST_D_TAG_PREFIX}${boardRef}`;
        const filter: any = {
            kinds: [30000],
            '#d': [dTag],
        };

        const timeoutMs = 1500;
        const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), timeoutMs)
                )
            ]);
        };

        try {
            let events: Set<any> = new Set();

            if (typeof (ndk as any).fetchEvents === 'function') {
                events = await withTimeout((ndk as any).fetchEvents(filter));
            } else if (typeof (ndk as any).fetchEvent === 'function') {
                const single = await withTimeout((ndk as any).fetchEvent(filter));
                if (single) events = new Set([single]);
            }

            const result: Record<string, EditorRequestInfo> = {};
            for (const ev of Array.from(events || [])) {
                const requester = ev?.pubkey;
                const eventId = ev?.id;
                if (!requester || !eventId) continue;

                const hasD = (ev.tags || []).some((t: any) => t?.[0] === 'd' && t?.[1] === dTag);
                if (!hasD) continue;

                const createdAt = typeof ev.created_at === 'number' ? ev.created_at : undefined;
                const reason = (ev.tags || []).find((t: any) => t?.[0] === 'reason')?.[1];
                const role = (ev.tags || []).find((t: any) => t?.[0] === 'role')?.[1];

                result[requester] = {
                    eventId,
                    createdAt,
                    reason: typeof reason === 'string' ? reason : undefined,
                    role: typeof role === 'string' ? role : undefined,
                };
            }

            return result;
        } catch (error: any) {
            if (error?.message !== 'timeout') {
                console.warn('⚠️ loadEditorRequestsForBoard fehlgeschlagen (best-effort):', error);
            }
            return {};
        }
    }

    /**
     * Debug/Recovery: löscht alle lokal versteckten Boards (Leave/Hide Registry).
     * Absichtlich best-effort und ohne Nebenwirkungen auf Tombstones.
     */
    public static clearAllHiddenBoards(): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(HIDDEN_BOARDS_KEY);
        } catch {
            // ignore
        }
    }

    private static removeLocalBoardCache(boardId: string): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(`kanban-${boardId}`);
        } catch {
            // ignore
        }
    }
    
    /**
     * Fügt einen Editor (Maintainer) zum Board hinzu
     * 
     * @param board - Das aktuelle Board
     * @param pubkey - Nostr Public Key (Hex) des neuen Editors
     * @param authStore - AuthStore für Permission-Check
     * @param ndk - NDK instance für Event-Publishing
     * @throws Error wenn kein Board aktiv oder Nutzer keine Berechtigung
     */
    public static async addEditor(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für addEditor (kein Publish ohne NDK)');
        }
        // Normalisiere npub → hex falls nötig
        let normalizedPubkey = pubkey;
        if (pubkey.startsWith('npub')) {
            try {
                const decoded = nip19.decode(pubkey);
                if (typeof decoded.data === 'string') {
                    normalizedPubkey = decoded.data;
                }
            } catch (e) {
                console.warn('⚠️ Konnte npub nicht decodieren, verwende Originalwert:', pubkey, e);
            }
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können neue Editoren einladen');
        }

        if (normalizedPubkey === board.author) {
            throw new Error('Board-Owner ist bereits Owner (kein Editor-Eintrag)');
        }
        
        if (board.isEditor(normalizedPubkey)) {
            throw new Error('Nutzer ist bereits Editor');
        }
        
        // 2. Lokale State aktualisieren
        const owner = board.author;
        const existing = Array.isArray(board.maintainers) ? board.maintainers : [];
        board.maintainers = Array.from(
            new Set([...existing.filter(p => typeof p === 'string' && p && p !== owner), normalizedPubkey])
        );
        
        // 3. Nostr Event publizieren (Board Update)
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event mit neuem Editor publiziert (p-tags=${board.maintainers?.length || 0} maintainers, followers=${board.followers?.length || 0})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board-Events:', error);
            // Rollback
            board.maintainers = board.maintainers.filter(p => p !== normalizedPubkey);
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Editor hinzugefügt: ${normalizedPubkey}`);
    }

    /**
     * Entfernt einen Editor vom Board
     */
    public static async removeEditor(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für removeEditor');
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canDeleteBoard(currentUser)) {
            throw new Error('Nur der Owner kann Editoren entfernen');
        }
        
        if (pubkey === board.author) {
            throw new Error('Board-Owner kann nicht entfernt werden');
        }
        
        if (!board.isEditor(pubkey)) {
            throw new Error('Nutzer ist kein Editor');
        }
        
        // 2. Lokale State aktualisieren
        board.maintainers = board.maintainers?.filter(p => p !== pubkey) || [];
        
        // 3. Nostr Event publizieren (Board Update)
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event ohne Editor publiziert (maintainers=${board.maintainers.length}, followers=${board.followers?.length || 0})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board-Events:', error);
            // Rollback
            board.maintainers = [...board.maintainers, pubkey];
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Editor entfernt: ${pubkey}`);
    }

    /**
     * Fügt einen Viewer (Follower) zum Board hinzu
     * Nutzt NIP-51 Follow Sets (Kind 30000)
     * 
     * @deprecated SECURITY VIOLATION! Diese Methode erstellt Follow-Set Events für andere Nutzer!
     * In Nostr kann nur der User selbst sein Follow-Set ändern (events sind signiert).
     * 
     * NEUE ARCHITEKTUR (Option 1):
     * - Owner teilt nur einen Share-Link
     * - User öffnet Link → sieht Board-Vorschau
     * - User klickt "Board folgen" → BoardStore.followBoard() wird aufgerufen
     * - followBoard() erstellt NIP-51 Event signiert vom USER selbst
     * - User kann jederzeit unfollowBoard() aufrufen (eigenes Follow-Set!)
     * 
     * DO NOT USE THIS METHOD! Use share link system instead.
     */
    public static async addViewer(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        console.warn('⚠️ DEPRECATED: addViewer() sollte nicht mehr verwendet werden! Nutze Share-Link System stattdessen.');
        throw new Error('addViewer() ist deprecated. Verwende Share-Link System für Viewer-Management.');
        
        // OLD IMPLEMENTATION BELOW - DO NOT USE
        /*
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für addViewer');
        }
        // Normalisiere npub → hex falls nötig
        let normalizedPubkey = pubkey;
        if (pubkey.startsWith('npub')) {
            try {
                const decoded = nip19.decode(pubkey);
                if (typeof decoded.data === 'string') {
                    normalizedPubkey = decoded.data;
                }
            } catch (e) {
                console.warn('⚠️ Konnte npub nicht decodieren, verwende Originalwert:', pubkey, e);
            }
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können Viewer einladen');
        }
        
        if (board.isViewer(normalizedPubkey)) {
            throw new Error('Nutzer ist bereits Viewer');
        }
        
        // 2. Lokale State aktualisieren
        if (!board.followers) {
            board.followers = [];
        }
        board.followers = [...board.followers, normalizedPubkey];
        
        // 3. NIP-51 Follow Set Event erstellen/aktualisieren
        try {
            await this.updateBoardFollowers(board, ndk);
            console.log(`🛰️ NIP-51 Follow Set Event aktualisiert`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Follow Set Events:', error);
            board.followers = board.followers.filter(p => p !== normalizedPubkey);
            throw new Error('Fehler beim Publizieren des Follow Set Updates');
        }

        // 4. Board Event publizieren damit Viewer das Board via #p Subscription sieht
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event mit neuem Viewer publiziert (maintainers=${board.maintainers?.length || 0}, followers=${board.followers.length})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events für Viewer:', error);
            // Rollback follower entfernen
            board.followers = board.followers.filter(p => p !== normalizedPubkey);
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Viewer hinzugefügt: ${normalizedPubkey}`);
        */
    }

    /**
     * Entfernt einen Viewer vom Board
     */
    public static async removeViewer(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für removeViewer');
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können Viewer entfernen');
        }
        
        if (!board.isViewer(pubkey)) {
            throw new Error('Nutzer ist kein Viewer');
        }
        
        // 2. Lokale State aktualisieren
        // Editoren können nicht als Viewer entfernt werden
        if (!board.isEditor(pubkey)) {
            board.followers = board.followers?.filter(p => p !== pubkey) || [];
        }
        
        // 3. NIP-51 Event aktualisieren
        try {
            await this.updateBoardFollowers(board, ndk);
            console.log(`🛰️ NIP-51 Follow Set Event aktualisiert`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Follow Set Events:', error);
            // Rollback
            if (!board.isEditor(pubkey)) {
                board.followers = [...board.followers, pubkey];
            }
            throw new Error('Fehler beim Publizieren des Follow Set Updates');
        }

        // 4. Board Event publizieren damit Viewer das Board nicht mehr via #p sieht
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event nach Viewer-Entfernung publiziert (maintainers=${board.maintainers?.length || 0}, followers=${board.followers?.length || 0})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events nach Viewer-Entfernung:', error);
            // Rollback follower wieder hinzufügen
            if (!board.isEditor(pubkey)) {
                board.followers = [...board.followers, pubkey];
            }
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Viewer entfernt: ${pubkey}`);
    }

    /**
     * Erstellt/Aktualisiert NIP-51 Follow Set Event für Viewer
     */
    private static async updateBoardFollowers(board: Board, ndk: NDK): Promise<void> {
        if (!board) return;
        
        const followEvent = new NDKEvent(ndk);
        followEvent.kind = 30000; // Follow Sets
        followEvent.tags = [
            ['d', `board-followers-${board.id}`],
            ['title', `Board Followers: ${board.name}`],
            ['description', 'Users following this Kanban board']
        ];
        
        // Alle Viewer hinzufügen (inklusive Editoren)
        const allViewers = new Set([
            ...(board.maintainers || []),
            ...(board.followers || [])
        ]);
        
        // Owner ist automatisch Viewer
        if (board.author) {
            allViewers.add(board.author);
        }
        
        allViewers.forEach(pubkey => {
            followEvent.tags.push(['p', pubkey]);
        });
        
        followEvent.content = '';
        const relays = await followEvent.publish();
        
        // Prüfe ob mindestens ein Relay geantwortet hat
        if (!relays || relays.size === 0) {
            throw new Error('⚠️ Keine Relays haben geantwortet. Bitte überprüfen Sie Ihre Relay-Verbindungen in den Einstellungen.');
        }
        
        console.log(`📤 NIP-51 Follow Set Event aktualisiert (${relays.size} Relay(s))`);
    }

    /**
     * Lädt alle Board-Teilnehmer (Editoren + Viewer)
     */
    public static async getBoardParticipants(
        board: Board
    ): Promise<BoardShare[]> {
        const participants: BoardShare[] = [];
        
        // Owner hinzufügen
        if (board?.author) {
            participants.push({
                pubkey: board.author,
                role: BoardRole.OWNER,
                addedAt: new Date().toISOString(),
                displayName: authStore.getDisplayNameForPubkey(board.author)
            });
        }
        
        // Editoren hinzufügen
        board?.maintainers?.forEach(pubkey => {
            participants.push({
                pubkey,
                role: BoardRole.EDITOR,
                addedAt: new Date().toISOString(),
                displayName: authStore.getDisplayNameForPubkey(pubkey)
            });
        });
        
        // Viewer hinzufügen
        board?.followers?.forEach(pubkey => {
            // Nur hinzufügen wenn nicht bereits Editor
            if (!board?.maintainers?.includes(pubkey) && pubkey !== board.author) {
                participants.push({
                    pubkey,
                    role: BoardRole.VIEWER,
                    addedAt: new Date().toISOString(),
                    displayName: authStore.getDisplayNameForPubkey(pubkey)
                });
            }
        });
        return participants;
    }

    /**
     * Lädt Board Follower aus NIP-51 Follow Set Events
     */
    public static async loadBoardFollowers(
        board: Board,
        ndk: NDK
    ): Promise<string[]> {
        try {
            const followSetFilter = {
                kinds: [30000],
                authors: [board.author!],
                '#d': [`board-followers-${board.id}`]
            };
            
            const followEvent = await ndk.fetchEvent(followSetFilter);
            
            if (followEvent) {
                const followers = followEvent.tags
                    .filter(tag => tag[0] === 'p')
                    .map(tag => tag[1])
                    .filter(pubkey => pubkey !== board.author && !board.maintainers?.includes(pubkey));
                
                console.log(`📥 Board Followers geladen: ${followers.length}`);
                return followers;
            }
            
            return [];
        } catch (error) {
            console.error('❌ Fehler beim Laden der Board Followers:', error);
            return [];
        }
    }

    /**
     * Publiziert Board-Update mit maintainers als p-tags
     */
    private static async publishBoardUpdate(board: Board, ndk: NDK): Promise<void> {
        const event = new NDKEvent(ndk);
        event.kind = 30301; // Board Event (Kind)
        event.tags = [
            ['d', board.id],
            ['title', board.name],
            ['description', board.description || '']
        ];
        
        // Author als p-tag (NIP-51 compliant: publisher)
        if (board.author) {
            event.tags.push(['p', board.author]);
        }
        
        // Maintainers (Editors) als p-tags hinzufügen (NIP-51 compliant)
        if (board.maintainers) {
            const owner = board.author;
            const maintainers = Array.from(
                new Set(
                    board.maintainers
                        .filter(p => typeof p === 'string' && p)
                        .filter(p => p !== owner)
                )
            );

            for (const maintainer of maintainers) {
                event.tags.push(['p', maintainer]);
            }
        }

        // NOTE: Followers (Viewers) werden NICHT als p-tags hinzugefügt!
        // Stattdessen werden sie via NIP-51 Follow Sets (Kind 30000) verwaltet
        // Das ist NIP-51 compliant und verhindert Verwirrung zwischen Editoren und Viewern
        
        // Spalten als col-tags
        if (board.columns) {
            for (let i = 0; i < board.columns.length; i++) {
                const col = board.columns[i];
                event.tags.push(['col', col.id, col.name, String(i), col.color || '']);
            }
        }
        
        event.content = '';
        
        try {
            const tagSummary = event.tags.filter(t => t[0] === 'p').map(t => t[1].substring(0, 12));
            console.log(`🔑 Publish Board Update: id=${board.id} p-tags(count=${tagSummary.length})=${JSON.stringify(tagSummary)}`);
            const relays = await event.publish();
            
            // Prüfe ob mindestens ein Relay geantwortet hat
            if (!relays || relays.size === 0) {
                throw new Error('⚠️ Keine Relays haben geantwortet. Bitte überprüfen Sie Ihre Relay-Verbindungen in den Einstellungen.');
            }
            
            console.log(`✅ Board Event publiziert (${relays.size} Relay(s), including maintainers + followers)`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events:', error);
            throw error;
        }
    }

    /**
     * Lädt alle Boards aus Nostr Events, bei denen der aktuelle Nutzer als Maintainer gelistet ist
     * 
     * @param currentUserPubkey - Aktueller Nutzer Pubkey
     * @param ndk - NDK instance für Event-Loading
     * @returns Array von geteilten Board-Metadaten
     */
    public static async loadSharedBoardsFromNostr(
        currentUserPubkey: string,
        ndk: NDK
    ): Promise<Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean; isShared: boolean; userRole: string; author?: string}>> {
        if (!ndk || !currentUserPubkey) {
            return [];
        }
        
        try {
            console.log('🔍 Lade geteilte Boards für Nutzer:', currentUserPubkey);
            
            // Suche nach Board Events (Kind 30301) wo currentUserPubkey als p-tag gelistet ist (Viewer/Editor)
            const boardEvents = await ndk.fetchEvents({
                kinds: [30301 as any], // Board Events
                '#p': [currentUserPubkey], // Nutzer muss als p-tag gelistet sein
                limit: 50 // Limit für Performance
            });
            
            const sharedBoards: Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean; isShared: boolean; userRole: string; author?: string}> = [];
            
            for (const event of boardEvents) {
                try {
                    // Extrahiere alle p-tags (NIP-51 compliant)
                    const pTagsAll = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
                    const canonicalOwner = event.pubkey; // Der Event-Publisher ist der Owner
                    
                    // Skip eigene Boards
                    if (canonicalOwner === currentUserPubkey) {
                        continue;
                    }
                    
                    // Board Metadaten aus Event extrahieren
                    const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
                    const title = event.tags.find(tag => tag[0] === 'title')?.[1];
                    const description = event.tags.find(tag => tag[0] === 'description')?.[1];
                    
                    if (!dTag || !title) {
                        console.warn('⚠️ Board Event ohne d-tag oder title:', event.id);
                        continue;
                    }
                    
                    // Bestimme Rolle des Nutzers (NIP-51 compliant)
                    // - Owner: Event-Publisher (=canonicalOwner)
                    // - Editor: In p-tags gelistet
                    // - Viewer: Via Kind 30000 Follow Set (separate, nicht hier)
                    let userRole = 'none';
                    if (canonicalOwner === currentUserPubkey) {
                        userRole = 'owner';
                    } else if (pTagsAll.includes(currentUserPubkey)) {
                        // Nutzer ist in p-tags = Editor (oder co-owner)
                        userRole = 'editor';
                    }
                    // NOTE: Viewer-Rolle wird via separate NIP-51 Follow Set Abfrage bestimmt
                    
                    // Ignoriere Boards die nicht mit diesem Nutzer geteilt sind
                    if (userRole === 'none') {
                        continue;
                    }
                    
                    // Board-Metadaten zusammenstellen
                    const boardMetadata = {
                        id: dTag,
                        name: title,
                        description: description || undefined,
                        createdAt: event.created_at ? event.created_at * 1000 : Date.now(),
                        updatedAt: event.created_at ? event.created_at * 1000 : undefined,
                        lastAccessed: undefined, // Nicht verfügbar für remote boards
                        hasUnseenChanges: false, // TODO: Implementiere Unseen Changes Detection
                        isShared: true,
                        userRole: userRole,
                        author: canonicalOwner
                    };
                    
                    sharedBoards.push(boardMetadata);
                    
                } catch (error) {
                    console.error('❌ Fehler beim Parsen des Board Events:', event.id, error);
                    continue;
                }
            }
            
            // 🔴 KRITISCH: Lade Followers für alle geteilten Boards aus NIP-51 Kind 30000
            // Dies ist nötig damit Viewer-Rollen korrekt angezeigt werden in der Board-Liste
            for (const sharedBoard of sharedBoards) {
                try {
                    const followSetFilter = {
                        kinds: [30000],
                        authors: [sharedBoard.author!],
                        '#d': [`board-followers-${sharedBoard.id}`]
                    };
                    
                    const followEvent = await ndk.fetchEvent(followSetFilter);
                    if (followEvent) {
                        const followers = followEvent.tags
                            .filter(tag => tag[0] === 'p')
                            .map(tag => tag[1])
                            .filter(pubkey => pubkey !== sharedBoard.author && pubkey !== currentUserPubkey);
                        
                        // Prüfe ob aktueller User ein Viewer ist
                        if (followers.includes(currentUserPubkey) && sharedBoard.userRole !== 'editor') {
                            sharedBoard.userRole = 'viewer';
                            console.log(`🔍 Board ${sharedBoard.id}: User ist Viewer (via Kind 30000)`);
                        } else if (followers.includes(currentUserPubkey) && sharedBoard.userRole === 'editor') {
                            console.log(`🔍 Board ${sharedBoard.id}: User ist Editor (p-tag trumpft Follow-Set)`);
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load followers for board ${sharedBoard.id}:`, error);
                    // Non-blocking - continue with other boards
                }
            }
            
            const filtered = sharedBoards.filter(b => !this.isBoardHidden(b.id, b.author));
            console.log(`📥 ${filtered.length} geteilte Boards geladen aus ${boardEvents.size} Events (hidden filtered: ${sharedBoards.length - filtered.length})`);
            return filtered;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden der geteilten Boards:', error);
            return [];
        }
    }

    /**
     * USER-CONTROLLED FOLLOW: Fügt Board zu EIGENER NIP-51 Follow-Set hinzu
     * Dies ist die RICHTIGE Methode für User, einem Board zu folgen!
     * Event wird vom User selbst signiert (nicht vom Board-Owner).
     * 
     * @param boardId - Board d-tag
     * @param boardAuthor - Board author pubkey (hex)
     * @param ndk - NDK instance
     */
    public static async followBoard(
        boardId: string,
        boardAuthor: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK erforderlich');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            throw new Error('Nutzer nicht eingeloggt');
        }
        
        console.log(`📥 Folge Board: ${boardId} von ${boardAuthor}`);

        // Wenn User explizit folgt, soll ein zuvor "verlassen"/"versteckt"es Board wieder sichtbar sein
        this.unhideBoard(boardId, boardAuthor);
        
        try {
            // 1. Aktuelles Follow-Set des Users laden (NIP-51 Kind 30000)
            const followSetFilter = {
                kinds: [30000],
                authors: [currentUser],
                '#d': [FOLLOW_SET_D_TAG]
            };
            
            const existingFollowSet = await ndk.fetchEvent(followSetFilter);
            
            // 2. Board-Referenz erstellen (NIP-01 a-tag Format)
            const boardRef = `30301:${boardAuthor}:${boardId}`;

            // Cross-Device: falls Board zuvor per Left-List versteckt wurde, entfernen wir den Eintrag (best-effort)
            try {
                await this.upsertLeftBoardsList(boardRef, 'remove', ndk);
            } catch (error) {
                console.warn('⚠️ followBoard: Entfernen aus Left-List fehlgeschlagen (best-effort):', error);
            }
            
            // 3. Neues Follow-Set Event erstellen
            const followSetEvent = new NDKEvent(ndk);
            followSetEvent.kind = 30000;
            followSetEvent.tags = [
                ['d', FOLLOW_SET_D_TAG] // Follow-Set identifier
            ];
            
            // Bestehende a-tags übernehmen (wenn vorhanden)
            if (existingFollowSet) {
                const existingATags = existingFollowSet.tags
                    .filter(tag => tag[0] === 'a')
                    .map(tag => tag[1]);
                
                // Nur hinzufügen wenn noch nicht vorhanden
                if (!existingATags.includes(boardRef)) {
                    existingATags.forEach(ref => {
                        followSetEvent.tags.push(['a', ref]);
                    });
                    followSetEvent.tags.push(['a', boardRef]);
                } else {
                    console.log('ℹ️ Board bereits im Follow-Set');
                    return;
                }
            } else {
                // Erstes Board im Follow-Set
                followSetEvent.tags.push(['a', boardRef]);
            }
            
            // 4. Event signieren und publizieren
            await followSetEvent.publish();
            console.log(`✅ Board zu Follow-Set hinzugefügt: ${boardRef}`);
            
        } catch (error) {
            console.error('❌ Fehler beim Folgen des Boards:', error);
            throw new Error('Fehler beim Hinzufügen zum Follow-Set');
        }
    }

    /**
     * USER-CONTROLLED UNFOLLOW: Entfernt Board aus EIGENER NIP-51 Follow-Set
     * User kann jederzeit sein eigenes Follow-Set ändern!
     * 
     * @param boardId - Board d-tag
     * @param boardAuthor - Board author pubkey (hex)
     * @param ndk - NDK instance
     */
    public static async unfollowBoard(
        boardId: string,
        boardAuthor: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK erforderlich');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            throw new Error('Nutzer nicht eingeloggt');
        }
        
        console.log(`📤 Entfolge Board: ${boardId}`);
        
        try {
            // 1. Aktuelles Follow-Set des Users laden
            const followSetFilter = {
                kinds: [30000],
                authors: [currentUser],
                '#d': [FOLLOW_SET_D_TAG]
            };
            
            const existingFollowSet = await ndk.fetchEvent(followSetFilter);
            
            if (!existingFollowSet) {
                console.log('ℹ️ Kein Follow-Set vorhanden');
                return;
            }
            
            // 2. Board-Referenz
            const boardRef = `30301:${boardAuthor}:${boardId}`;
            
            // 3. Neues Follow-Set ohne das Board erstellen
            const followSetEvent = new NDKEvent(ndk);
            followSetEvent.kind = 30000;
            followSetEvent.tags = [
                ['d', FOLLOW_SET_D_TAG]
            ];
            
            // Alle a-tags AUSSER das zu entfernende Board
            const remainingATags = existingFollowSet.tags
                .filter(tag => tag[0] === 'a' && tag[1] !== boardRef)
                .map(tag => tag[1]);
            
            remainingATags.forEach(ref => {
                followSetEvent.tags.push(['a', ref]);
            });
            
            // 4. Event signieren und publizieren
            await followSetEvent.publish();
            console.log(`✅ Board aus Follow-Set entfernt: ${boardRef}`);
            
        } catch (error) {
            console.error('❌ Fehler beim Entfolgen des Boards:', error);
            throw new Error('Fehler beim Entfernen aus Follow-Set');
        }
    }

    /**
     * Verlässt ein geteiltes Board (entfernt den aktuellen Nutzer aus den Maintainern/Followern)
     * 
     * @param boardId - Board ID
     * @param currentUserPubkey - Aktueller Nutzer Pubkey
     * @param ndk - NDK instance für Event-Publishing
     */
    public static async leaveBoard(
        boardId: string,
        currentUserPubkey: string,
        ndk?: NDK,
        boardAuthor?: string
    ): Promise<void> {
        try {
            if (!currentUserPubkey) {
                throw new Error('Nutzer-Pubkey nicht verfügbar');
            }

            console.log('🚪 Verlasse Board:', { boardId, boardAuthor: boardAuthor?.slice(0, 12) });

            // 1) Immer lokal verstecken (Editor kann nicht autoritativ aus Owner-Event entfernt werden)
            //    und lokalen Cache entfernen, damit es NICHT als lokales Board wieder auftaucht.
            this.hideBoard(boardId, boardAuthor, 'left');
            this.removeLocalBoardCache(boardId);

            if (boardAuthor) {
                console.log('🙈 leaveBoard: lokal versteckt + Cache entfernt', {
                    boardId,
                    boardRef: `30301:${boardAuthor}:${boardId}`,
                });
            } else {
                console.log('🙈 leaveBoard: lokal versteckt + Cache entfernt', {
                    boardId,
                    boardRef: null,
                });
            }

            // 2) Wenn NDK verfügbar: best-effort Rolle erkennen + unfollow (Viewer-Fall)
            if (!ndk) {
                console.log('ℹ️ leaveBoard: Kein NDK – nur lokal versteckt');
                return;
            }

            let resolvedAuthor = boardAuthor;

            // Falls kein Author bekannt: best-effort über Board Event auflösen
            if (!resolvedAuthor) {
                const eventAny = await ndk.fetchEvent({
                    kinds: [30301 as any],
                    '#d': [boardId]
                } as any);
                if (eventAny?.pubkey) {
                    resolvedAuthor = eventAny.pubkey;
                }
            }

            const filter: any = resolvedAuthor
                ? { kinds: [30301 as any], authors: [resolvedAuthor], '#d': [boardId] }
                : { kinds: [30301 as any], '#d': [boardId] };

            const boardEvent: any = await ndk.fetchEvent(filter);
            const pTags: string[] = boardEvent?.tags
                ? boardEvent.tags.filter((t: any) => t[0] === 'p').map((t: any) => t[1])
                : [];
            const canonicalOwner: string | undefined = boardEvent?.pubkey || resolvedAuthor;

            const isOwner = canonicalOwner === currentUserPubkey;
            const isEditor = !isOwner && pTags.includes(currentUserPubkey);

            // 2.5) Cross-Device Leave: NIP-51 Left-Boards Liste updaten (best-effort, nur wenn wir die Adresse kennen)
            if (resolvedAuthor) {
                const boardRef = `30301:${resolvedAuthor}:${boardId}`;
                try {
                    await this.upsertLeftBoardsList(boardRef, 'add', ndk);
                } catch (error) {
                    console.warn('⚠️ leaveBoard: Left-List Update fehlgeschlagen (best-effort):', error);
                }

                // 2.6) Leave Request: Editor kann Owner nicht selbst aus p-tags entfernen → Request an Owner
                if (isEditor && canonicalOwner) {
                    try {
                        await this.publishLeaveRequest(boardRef, canonicalOwner, ndk);
                    } catch (error) {
                        console.warn('⚠️ leaveBoard: Leave-Request Publish fehlgeschlagen (best-effort):', error);
                    }
                }
            }

            // 3) Viewer-Fall: Unfollow im eigenen NIP-51 Follow-Set (best-effort)
            //    Editor-Fall: kann nicht aus p-tags entfernt werden → lokale Hide-Registry ist Source of Truth.
            if (!isEditor && resolvedAuthor) {
                try {
                    await this.unfollowBoard(boardId, resolvedAuthor, ndk);
                } catch (error) {
                    console.warn('⚠️ leaveBoard: Unfollow fehlgeschlagen (Board bleibt lokal versteckt):', error);
                }
            }

            console.log(`✅ Board ${boardId} verlassen (hidden locally${!isEditor && resolvedAuthor ? ' + unfollow attempted' : ''})`);
        } catch (error) {
            console.error('❌ Fehler beim Verlassen des Boards:', error);
            throw error;
        }
    }
    
    /**
     * Lädt Boards aus dem User's eigenen NIP-51 Follow-Set (Kind 30000)
     * Dies sind Boards, denen der User via "Folgen" folgt (Viewer-Rolle)
     * 
     * @param currentUserPubkey - Aktueller Nutzer Pubkey
     * @param ndk - NDK instance
     * @returns Array von Board-Metadaten
     */
    public static async loadFollowedBoardsFromNostr(
        currentUserPubkey: string,
        ndk: NDK
    ): Promise<Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; isShared: boolean; userRole: string; author?: string}>> {
        console.log(`🔍 loadFollowedBoardsFromNostr called with pubkey: ${currentUserPubkey.slice(0, 8)}...`);
        
        if (!ndk || !currentUserPubkey) {
            console.log('⚠️ NDK oder currentUserPubkey nicht verfügbar für Follow-Set Loading');
            return [];
        }
        
        try {
            console.log('📡 Starte Nostr Abfrage für Follow-Set (Kind 30000)...');
            
            // Lade User's eigenes Follow-Set (NIP-51 Kind 30000)
            const followSetFilter = {
                kinds: [30000],
                authors: [currentUserPubkey],
                '#d': ['kanban-boards']
            };
            
            const followSetEvent = await ndk.fetchEvent(followSetFilter);
            
            if (!followSetEvent) {
                console.log('ℹ️ Kein Follow-Set Event gefunden (NIP-51 Kind 30000)');
                return [];
            }
            
            console.log(`✅ Follow-Set Event gefunden:`, followSetEvent.id);
            
            // Extrahiere Board-Referenzen aus a-tags
            // Format: 30301:boardAuthor:boardId
            const aTags = followSetEvent.tags
                .filter(tag => tag[0] === 'a')
                .map(tag => tag[1]);
            
            console.log(`📥 ${aTags.length} Board-Referenzen in Follow-Set a-tags gefunden`);
            
            const followedBoards: Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; isShared: boolean; userRole: string; author?: string}> = [];
            
            // Für jede Board-Referenz: Board-Event von Nostr laden
            for (const aTag of aTags) {
                try {
                    const parts = aTag.split(':');
                    if (parts.length !== 3 || parts[0] !== '30301') {
                        console.warn('⚠️ Ungültiger a-tag:', aTag);
                        continue;
                    }
                    
                    const [_, boardAuthor, boardId] = parts;
                    console.log(`🔄 Lade Board ${boardId.slice(0, 8)}... von Author ${boardAuthor.slice(0, 8)}...`);
                    
                    // Board Event laden
                    const boardEvent = await ndk.fetchEvent({
                        kinds: [30301 as any],
                        authors: [boardAuthor],
                        '#d': [boardId]
                    });
                    
                    if (!boardEvent) {
                        console.warn(`⚠️ Board Event nicht gefunden für: ${boardId.slice(0, 8)}...`);
                        continue;
                    }
                    
                    console.log(`✅ Board Event gefunden: ${boardEvent.id?.slice(0, 8)}...`);
                    
                    // Board-Metadaten extrahieren
                    const title = boardEvent.tags.find(tag => tag[0] === 'title')?.[1];
                    const description = boardEvent.tags.find(tag => tag[0] === 'description')?.[1];
                    
                    if (!title) {
                        console.warn('⚠️ Board Event ohne Titel:', boardEvent.id);
                        continue;
                    }
                    
                    console.log(`✅ Board geladen: "${title}"`);
                    
                    followedBoards.push({
                        id: boardId,
                        name: title,
                        description: description || undefined,
                        createdAt: boardEvent.created_at ? boardEvent.created_at * 1000 : Date.now(),
                        updatedAt: boardEvent.created_at ? boardEvent.created_at * 1000 : undefined,
                        isShared: true,
                        userRole: 'viewer', // Immer Viewer weil aus Follow-Set
                        author: boardAuthor
                    });
                    
                } catch (error) {
                    console.error('❌ Fehler beim Laden eines followed Boards:', error);
                    continue;
                }
            }
            
            const filtered = followedBoards.filter(b => !this.isBoardHidden(b.id, b.author));
            console.log(`✅ ${filtered.length} Boards aus Follow-Set geladen (hidden filtered: ${followedBoards.length - filtered.length})`);
            return filtered;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden des Follow-Sets:', error);
            return [];
        }
    }
    
    /**
     * Lädt ein Board-Event von Nostr (für Board-Vorschau bei Share-Links)
     * 
     * @param boardId - Board D-Tag
     * @param boardAuthor - Board-Ersteller Pubkey
     * @param ndk - NDK instance
     * @returns Board-Props Objekt oder null wenn nicht gefunden
     */
    public static async fetchBoardFromNostr(
        boardId: string,
        boardAuthor: string,
        ndk: NDK
    ): Promise<BoardProps | null> {
        if (!ndk || !boardId || !boardAuthor) {
            throw new Error('NDK, Board-ID und Autor erforderlich');
        }
        
        console.log(`🔍 Lade Board-Vorschau: ${boardId} von ${boardAuthor}`);
        
        try {
            // Board Event von Nostr laden (NIP-01 Kind 30301)
            const filter = {
                kinds: [30301],
                authors: [boardAuthor],
                '#d': [boardId]
            };
            
            const event = await ndk.fetchEvent(filter);
            
            if (!event) {
                console.warn(`⚠️ Board nicht gefunden: ${boardId}`);
                return null;
            }
            
            console.log(`✅ Board Event geladen:`, event);
            
            // Event zu Board Props konvertieren
            const { nostrEventToBoard } = await import('$lib/utils/nostrEvents.js');
            const boardProps = nostrEventToBoard(event);
            
            console.log(`✅ Board-Vorschau erstellt:`, boardProps);
            return boardProps;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden des Board-Events:', error);
            throw new Error('Board konnte nicht von Nostr geladen werden');
        }
    }
}
