// src/lib/stores/boardstore/sharing.ts
// Board-Sharing & Maintainer-System API

import { Board } from '../../classes/BoardModel.js';
import { BoardRole, type BoardShare } from '../../types/sharing.js';
import { authStore } from '../authStore.svelte.js';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export class BoardSharingOperations {
    
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
        ndk?: NDK
    ): Promise<void> {
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können neue Editoren einladen');
        }
        
        if (board.isEditor(pubkey)) {
            throw new Error('Nutzer ist bereits Editor');
        }
        
        // 2. Lokale State aktualisieren
        if (!board.maintainers) {
            board.maintainers = [];
        }
        board.maintainers = [...board.maintainers, pubkey];
        
        // 3. Nostr Event publizieren (Board Update)
        if (ndk) {
            try {
                await this.publishBoardUpdate(board, ndk);
                console.log(`🛰️ Board Event mit neuem Editor publiziert`);
            } catch (error) {
                console.error('❌ Fehler beim Publizieren des Board-Events:', error);
                // Rollback
                board.maintainers = board.maintainers.filter(p => p !== pubkey);
                throw new Error('Fehler beim Publizieren des Board-Updates');
            }
        }
        
        console.log(`✅ Editor hinzugefügt: ${pubkey}`);
    }

    /**
     * Entfernt einen Editor vom Board
     */
    public static async removeEditor(
        board: Board,
        pubkey: string,
        ndk?: NDK
    ): Promise<void> {
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
        if (ndk) {
            try {
                await this.publishBoardUpdate(board, ndk);
                console.log(`🛰️ Board Event ohne Editor publiziert`);
            } catch (error) {
                console.error('❌ Fehler beim Publizieren des Board-Events:', error);
                // Rollback
                board.maintainers = [...board.maintainers, pubkey];
                throw new Error('Fehler beim Publizieren des Board-Updates');
            }
        }
        
        console.log(`✅ Editor entfernt: ${pubkey}`);
    }

    /**
     * Fügt einen Viewer (Follower) zum Board hinzu
     * Nutzt NIP-51 Follow Sets (Kind 30000)
     */
    public static async addViewer(
        board: Board,
        pubkey: string,
        ndk?: NDK
    ): Promise<void> {
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können Viewer einladen');
        }
        
        if (board.isViewer(pubkey)) {
            throw new Error('Nutzer ist bereits Viewer');
        }
        
        // 2. Lokale State aktualisieren
        if (!board.followers) {
            board.followers = [];
        }
        board.followers = [...board.followers, pubkey];
        
        // 3. NIP-51 Follow Set Event erstellen/aktualisieren
        if (ndk) {
            try {
                await this.updateBoardFollowers(board, ndk);
                console.log(`🛰️ NIP-51 Follow Set Event aktualisiert`);
            } catch (error) {
                console.error('❌ Fehler beim Publizieren des Follow Set Events:', error);
                // Rollback
                board.followers = board.followers.filter(p => p !== pubkey);
                throw new Error('Fehler beim Publizieren des Follow Set Updates');
            }
        }
        
        console.log(`✅ Viewer hinzugefügt: ${pubkey}`);
    }

    /**
     * Entfernt einen Viewer vom Board
     */
    public static async removeViewer(
        board: Board,
        pubkey: string,
        ndk?: NDK
    ): Promise<void> {
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
        if (ndk) {
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
        await followEvent.publish();
        console.log('📤 NIP-51 Follow Set Event aktualisiert');
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
        
        // Author als p-tag
        if (board.author) {
            event.tags.push(['p', board.author]);
        }
        
        // Maintainers als p-tags hinzufügen
        if (board.maintainers) {
            for (const maintainer of board.maintainers) {
                event.tags.push(['p', maintainer]);
            }
        }
        
        // Spalten als col-tags
        if (board.columns) {
            for (let i = 0; i < board.columns.length; i++) {
                const col = board.columns[i];
                event.tags.push(['col', col.id, col.name, String(i), col.color || '']);
            }
        }
        
        event.content = '';
        
        try {
            await event.publish();
            console.log('✅ Board Event publiziert mit maintainers');
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events:', error);
            throw error;
        }
    }
}